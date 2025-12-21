import { useEffect, useRef, useState } from "react";
import socket from "../Socket";
import { Device } from "mediasoup-client";
import type { AppData, RtpCapabilities, Transport, TransportOptions } from "mediasoup-client/types";

interface useViewStreamParams {
    roomID: string | undefined
}

const useViewStream = ({ roomID }: useViewStreamParams) => {

    if (!roomID) {
        throw new Error("No roomid provided")
    }

    const [stream, setStream] = useState<MediaStream>()
    const [roomFull, setRoomFull] = useState(false);
    const [status, setStatus] = useState<"ok" | "loading" | "error">("loading");
    const [statusMessage, setStatusMessage] = useState("Loading");
    const [rtpStats, setRtpStats] = useState<Array<string>>([]);
    const firstLaunchRef = useRef(true);
    useEffect(() => {
        let isFirstLaunch = firstLaunchRef.current;
        let rtpCapabilities: RtpCapabilities;
        let consuming = false;
        let device: Device;
        let consumerTransport: Transport;

        const getStatsInterval = setInterval(async () => {
            if (consumerTransport) {
                const stats = await consumerTransport.getStats();
                const statsArray: Array<string> = [];
                stats.forEach((report) => {
                    Object.keys(report).forEach((statName) => {
                        if (
                            statName !== "id" &&
                            statName !== "timestamp" &&
                            statName !== "type" &&
                            statName !== "base64Certificate"
                        ) {
                            statsArray.push(`${statName}: ${report[statName]}`)
                        }
                    })
                })
                setRtpStats(statsArray)
            }
        }, 1000);


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

                consumerTransport.on("connectionstatechange", (state) => {
                    switch (state) {
                        case "connecting":
                            setStatus("loading")
                            setStatusMessage("Connecting")
                            break;

                        case "failed":
                            setStatus("error")
                            consumerTransport.removeAllListeners();
                            setStatusMessage("Webrtc connection failed")
                            break;

                        case "closed":
                            setStatus("error")
                            setStatusMessage("Webrtc connection closed")
                            break;

                        case "connected":
                            setStatus("ok")
                            setStatusMessage("Webrtc connected")
                            break;

                        case "disconnected":
                            setStatus("error")
                            setStatusMessage("Webrtc disconnected")
                            break;

                        default:
                            break;
                    }
                })

                socket.emit("consume", { rtpCapabilities: device.rtpCapabilities }, async (data: { error: any; id: any; producerId: any; kind: any; rtpParameters: any; }) => {
                    if (data.error) {
                        console.error(data.error)
                        console.log("no producer yet");
                        setStatus("loading");
                        setStatusMessage("Waiting for stream")
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
                    setStatus("ok")
                    setStatusMessage("Connected")
                });
            });
        }

        // socket event handlers

        const rtpHandler = (capabilities: RtpCapabilities) => {
            isFirstLaunch = false;
            firstLaunchRef.current = isFirstLaunch;
            rtpCapabilities = capabilities;
        }

        const onConnected = () => {
            setStatus("loading");
            setStatusMessage("Connected to server")
            if (isFirstLaunch == false) {
                socket.emit("joinroom", roomID, false)
            }
        }

        const onDisconnected = () => {
            consuming = false;
            setStatusMessage("Disconnected");
            setStatus("error");
        }

        const onHostLeft = () => {
            consuming = false;
            console.log("Host left")
            setStatus("loading")
            setStatusMessage("Host left, waiting for stream")
            socket.emit("reset")
        }

        const onResetStream = () => {
            consuming = false;
            console.log("Resetting stream");
            setStatus("loading");
            setStatusMessage("Waiting for stream")
            socket.emit("reset")
        }

        const onReady2View = () => {
            setStatus("loading");
            setStatusMessage("Connecting");
            console.log("Ready to view", rtpCapabilities)
            rtpCapabilities ? startConsuming(rtpCapabilities) : null;
        }

        const onRoomFull = () => {
            setRoomFull(true)
        }

        // attach socket event handlers
        socket.on("hostleft", onHostLeft);
        socket.on("resetStream", onResetStream);
        socket.on("ready2view", onReady2View)
        socket.on("room_full", onRoomFull);
        socket.on("routerRtpCapabilities", rtpHandler);
        socket.on("connect", onConnected);
        socket.on("disconnect", onDisconnected);

        console.log("Joining")
        socket.emit("joinroom", roomID, false)

        // cleanup/detach socket event handlers
        return () => {
            clearInterval(getStatsInterval)
            socket.off("resetStream", onResetStream);
            socket.off("room_full", onRoomFull)
            socket.off("routerRtpCapabilities", rtpHandler)
            socket.off("connect", onConnected);
            socket.off("disconnect", onDisconnected);
            socket.off("hostleft", onHostLeft);
            socket.off("ready2view", startConsuming);
            socket.emit("leaveroom");
            socket.off("ready2view", onReady2View)
            consumerTransport?.removeAllListeners();
        }
    }, [])

    return {
        roomFull,
        stream,
        status,
        statusMessage,
        rtpStats
    }
}

export default useViewStream;