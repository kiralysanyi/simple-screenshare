//stream ui and all of its shit

import { useEffect, useState } from "react";
import socket from "./Socket";
import { useParams } from "react-router";
import getStream from "./utils/getStream";
import { Device } from "mediasoup-client";
import type { AppData, RtpCapabilities, Transport, TransportOptions } from "mediasoup-client/types";
import StreamViewer from "./StreamViewer";


const Stream = () => {

    const [isConnected, setIsConnected] = useState(false)
    //const [password, setPassword] = useState("");
    const [showModal, setShowModal] = useState(false);
    const roomID = useParams()["id"];
    const [previewStream, setPreviewStream] = useState<MediaStream>()

    useEffect(() => {
        let producerTransport: Transport;
        const onConnected = () => {
            setIsConnected(true)
        }

        const onDisconnected = () => {
            setIsConnected(false)
            socket.emit("joinroom", roomID, true)
        }

        // média leves

        let device = new Device();

        const onRouterRtpCapabilities = async (capabilities: RtpCapabilities) => {
            console.log(capabilities)
            // setup rtp
            if (device.loaded) {
                device = new Device();                
            }
            await device.load({ routerRtpCapabilities: capabilities })
            console.log("Loaded rtp capabilities of server")

            // setup transport
            const stream = await getStream();
            setPreviewStream(stream);
            const copiedStream = new MediaStream([stream.getVideoTracks()[0]])
            const videoTrack = copiedStream?.getVideoTracks()[0];

            socket.emit("createProducerTransport", {}, async (params: TransportOptions<AppData>) => {
                producerTransport = device.createSendTransport(params);

                producerTransport.on("connect", ({ dtlsParameters }, cb) => {
                    socket.emit("connectProducerTransport", { dtlsParameters }, cb);
                });

                producerTransport.on("produce", ({ kind, rtpParameters }, cb) => {
                    socket.emit("produce", { kind, rtpParameters }, cb);
                });

                await producerTransport.produce({
                    track: videoTrack,
                    codec: {
                        preferredPayloadType: 96,
                        kind: 'video',
                        mimeType: 'video/VP8',
                        clockRate: 90000,
                        parameters: {
                            'x-google-start-bitrate': 1000
                        }
                    }
                });
            })

        }

        const onAuthRequired = (authNeeded: boolean) => {
            if (authNeeded) {
                setShowModal(true)
                return;
            }

            socket.emit("joinroom", roomID, true)
        }

        const onNameChange = (name: string) => {
            console.log(name)
        }



        socket.on("connect", onConnected);
        socket.on("disconnect", onDisconnected);
        socket.on("auth_required", onAuthRequired);
        socket.on("routerRtpCapabilities", onRouterRtpCapabilities);
        socket.on("namechange", onNameChange)

        setIsConnected(socket.connected);

        socket.emit("joinroom", roomID, true)

        return () => {
            socket.off("connect", onConnected);
            socket.off("disconnect", onDisconnected);
            socket.off("auth_required", onAuthRequired);
            socket.off("routerRtpCapabilities", onRouterRtpCapabilities);
            socket.off("namechange", onNameChange);
        }
    }, [])

    return <>
        <div>
            {/* Video preview */}
            <div>
                {previewStream ? <StreamViewer stream={previewStream}></StreamViewer> : ""}
                <span>Connected: {isConnected ? "yes" : "no"}</span>
            </div>
            {/* Config */}
            <div></div>
        </div>
        {showModal ? <div className="modal"></div> : ""}
    </>
}

export default Stream;