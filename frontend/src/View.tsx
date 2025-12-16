import { useEffect, useRef, useState } from "react";
import socket from "./Socket";
import { Device } from "mediasoup-client";
import type { AppData, RtpCapabilities, Transport, TransportOptions } from "mediasoup-client/types";
import { useParams } from "react-router";
import StreamViewer from "./StreamViewer";
import "./css/view.css"
import StatusIndicator from "./StatusIndicator";
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, InformationCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";


const View = () => {

    const [stream, setStream] = useState<MediaStream>()
    const roomID = useParams()["id"];
    const [roomFull, setRoomFull] = useState(false);
    const [status, setStatus] = useState<"ok" | "loading" | "error">("loading");
    const [statusMessage, setStatusMessage] = useState("Loading");
    const [showStats, setShowStats] = useState(false);
    const [rtpStats, setRtpStats] = useState<Array<string>>([]);
    const firstLaunchRef = useRef(true);

    useEffect(() => {
        let isFirstLaunch = firstLaunchRef.current;
        let rtpCapabilities: RtpCapabilities;

        const onConnected = () => {
            setStatus("loading");
            setStatusMessage("Connected to server")
            if (isFirstLaunch == false) {
                socket.emit("joinroom", roomID, false)
            }
        }

        let consuming = false;

        const onDisconnected = () => {
            consuming = false;
            setStatusMessage("Disconnected");
            setStatus("error");
        }

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

        const rtpHandler = (capabilities: RtpCapabilities) => {
            isFirstLaunch = false;
            firstLaunchRef.current = isFirstLaunch;
            rtpCapabilities = capabilities;
        }


        socket.on("routerRtpCapabilities", rtpHandler);

        socket.on("connect", onConnected);
        socket.on("disconnect", onDisconnected);
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

        socket.on("hostleft", onHostLeft);
        socket.on("resetStream", onResetStream);

        socket.on("ready2view", () => {
            setStatus("loading");
            setStatusMessage("Connecting");
            console.log("Ready to view", rtpCapabilities)
            rtpCapabilities ? startConsuming(rtpCapabilities) : null;
        })

        const onRoomFull = () => {
            setRoomFull(true)
        }

        socket.on("room_full", onRoomFull)

        console.log("Joining")
        socket.emit("joinroom", roomID, false)

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
            consumerTransport?.removeAllListeners();
        }
    }, [])

    // fullscreen/controls handler
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);

    useEffect(() => {
        function onFullscreenChange() {
            setIsFullscreen(Boolean(document.fullscreenElement));
        }

        let hideTimeout: number;

        const onMouseMove = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout)
            }

            hideTimeout = setTimeout(() => {
                setShowControls(false)
            }, 5000);

            setShowControls(true)
        }

        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener("mousemove", onMouseMove);

        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener("mousemove", onMouseMove);
            document.exitFullscreen();
        }
    }, [])

    const toggleFullscreen = () => {
        if (!isFullscreen) {
            document.body.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // wakelock

    useEffect(() => {
        let wakelock: WakeLockSentinel | undefined;

        navigator.wakeLock.request().then((wl) => {
            wakelock = wl;
        })

        return () => {
            if (wakelock) {
                wakelock.release();
            }
        }
    }, [])

    return <>
        {stream ? <StreamViewer className="streamView" stream={stream} /> : ""}
        {roomFull ? <div className="modal_bg"><div className="modal">
            <h1>This room is full, please try again later.</h1>
        </div></div> : ""}
        <div className={`controls ${showControls ? "" : "hidden"}`}>
            <div className="btn" onClick={toggleFullscreen}>
                {isFullscreen ? <ArrowsPointingInIcon color="white" width={32} height={32} /> : <ArrowsPointingOutIcon color="white" width={32} height={32} />}
            </div>
            <div className="btn" onClick={() => { setShowStats(!showStats) }}>
                {showStats ? <XCircleIcon width={32} height={32} color="red" /> : <InformationCircleIcon width={32} height={32} />}
            </div>
        </div>
        <StatusIndicator message={statusMessage} status={status} />
        {showStats ? <div className="statsDisplay">
            {rtpStats.map((stat) => <span>{stat}</span>)}
        </div> : ""}
    </>
}

export default View;