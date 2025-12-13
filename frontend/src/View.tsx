import { useEffect, useState } from "react";
import socket from "./Socket";
import { Device } from "mediasoup-client";
import type { AppData, RtpCapabilities, Transport, TransportOptions } from "mediasoup-client/types";
import { useParams } from "react-router";
import StreamViewer from "./StreamViewer";
import "./css/view.css"


const View = () => {

    const [stream, setStream] = useState<MediaStream>()
    const roomID = useParams()["id"];

    useEffect(() => {
        let isFirstLaunch = true;
        let rtpCapabilities: RtpCapabilities;

        const onConnected = () => {
            if (isFirstLaunch == false) {
                console.log("Re attaching", socket.connected)
                socket.emit("joinroom", roomID, false)
            }
        }

        let consuming = false;

        const onDisconnected = () => {
            consuming = false;
        }

        let device: Device;
        let consumerTransport: Transport;


        async function startConsuming(capabilities: RtpCapabilities) {
            if (consuming == true) {
                return
            }
            consuming = true;
            console.log("Start playing")
            device = new Device();
            await device.load({ routerRtpCapabilities: capabilities });
            console.log("Device loaded")

            socket.emit("createConsumerTransport", {}, (params: TransportOptions<AppData>) => {
                console.log("Creating transport")
                consumerTransport = device.createRecvTransport(params);

                consumerTransport.on("connect", ({ dtlsParameters }, cb) => {
                    socket.emit("connectConsumerTransport", { dtlsParameters }, cb);
                });

                socket.emit("consume", { rtpCapabilities: device.rtpCapabilities }, async (data: { error: any; id: any; producerId: any; kind: any; rtpParameters: any; }) => {
                    if (data.error) {
                        console.error(data.error)
                        console.log("no producer yet");
                        consuming = false;
                        return;
                    }

                    const consumer = await consumerTransport.consume({
                        id: data.id,
                        producerId: data.producerId,
                        kind: data.kind,
                        rtpParameters: data.rtpParameters,

                    });

                    console.log("Setting stream")

                    console.log(consumer.track)
                    setStream(new MediaStream([consumer.track]));
                });
            });
        }

        const rtpHandler = (capabilities: RtpCapabilities) => {
            isFirstLaunch = false;
            rtpCapabilities = capabilities;
        }


        socket.on("routerRtpCapabilities", rtpHandler);

        socket.on("connect", onConnected);
        socket.on("disconnect", onDisconnected);
        const onHostLeft = () => {
            consuming = false;
            console.log("Host left")
            socket.emit("reset")
        }
        socket.on("hostleft", onHostLeft)

        socket.on("ready2view", () => {
            console.log("Ready to view", rtpCapabilities)
            rtpCapabilities ? startConsuming(rtpCapabilities) : null;
        })
        console.log("Joining")
        socket.emit("joinroom", roomID, false)

        return () => {
            socket.off("routerRtpCapabilities", rtpHandler)
            socket.off("connect", onConnected);
            socket.off("disconnect", onDisconnected);
            socket.off("hostleft", onHostLeft);
            socket.off("ready2view", startConsuming)
            socket.emit("leaveroom")
        }
    }, [])

    return <>
        {stream ? <StreamViewer className="streamView" stream={stream} /> : ""}
    </>
}

export default View;