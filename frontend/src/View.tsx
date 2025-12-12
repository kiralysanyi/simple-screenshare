import { useEffect, useRef, useState } from "react";
import socket from "./Socket";
import { Device } from "mediasoup-client";
import type { AppData, RtpCapabilities, Transport, TransportOptions } from "mediasoup-client/types";
import { useParams } from "react-router";
import StreamViewer from "./StreamViewer";

const View = () => {

    const [stream, setStream] = useState<MediaStream>()
    const roomID = useParams()["id"];

    useEffect(() => {

        let device: Device;
        let consumerTransport: Transport;

        const rtpHandler = (capabilities: RtpCapabilities) => {
            let consuming = false;

            async function startConsuming() {
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

            socket.on("ready2view", startConsuming)
            startConsuming();
            console.log("kecske")

        }

        socket.on("routerRtpCapabilities", rtpHandler);

        socket.emit("joinroom", roomID, false)

        return () => {
            socket.off("routerRtpCapabilities", rtpHandler)
        }
    }, [])

    return <>
        {stream ? <StreamViewer stream={stream} /> : ""}
    </>
}

export default View;