//stream ui and all of its shit

import { useCallback, useEffect, useRef, useState } from "react";
import socket from "./Socket";
import { useParams } from "react-router";
import getStream from "./utils/getStream";
import { Device } from "mediasoup-client";
import type { AppData, ProducerOptions, RtpCapabilities, Transport, TransportOptions } from "mediasoup-client/types";
import StreamViewer from "./StreamViewer";
import "./css/streamer.css"


const Stream = () => {

    const deviceRef = useRef<Device | null>(null);
    const producerTransportRef = useRef<Transport | null>(null);

    const [isConnected, setIsConnected] = useState(false)
    const [password, setPassword] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const roomID = useParams()["id"];
    const [previewStream, setPreviewStream] = useState<MediaStream>()
    const [framerate, setFramerate] = useState(15)
    const [codec, setCodec] = useState("VP9")
    const firstRender = useRef(true);
    const [viewers, setViewers] = useState(0);
    const [roomName, setRoomName] = useState("");
    const [viewerLimit, setViewerLimit] = useState(20);
    const [rtcConnectionState, setRtcConnectionState] = useState("disconnected");
    const streamingRef = useRef(false);


    const setupTransport = useCallback(async () => {
        const device = deviceRef.current

        if (!device) {
            console.error("Something went wrong, device object is empty.")
            return;
        }
        // setup transport
        const stream = await getStream(framerate); // first param is framerate
        setPreviewStream(stream);
        const videoTrack = stream?.getVideoTracks()[0];

        const onEnded = () => {
            console.log("Ended stream by browser");
            setRtcConnectionState("disconnected")
            setStreamStarted(false);
            streamingRef.current = false;
            socket.emit("resetStream");
            producerTransportRef.current?.close();
        }
        videoTrack?.addEventListener("ended", onEnded)
        console.log(videoTrack)
        if (videoTrack) {
            console.log("Added end listener to track: ", videoTrack)
        }

        socket.emit("createProducerTransport", {}, async (params: TransportOptions<AppData>) => {
            let producerTransport = device.createSendTransport(params);
            producerTransportRef.current = producerTransport;

            producerTransport.on("connect", ({ dtlsParameters }, cb) => {
                socket.emit("connectProducerTransport", { dtlsParameters }, cb);
            });

            producerTransport.on("produce", ({ kind, rtpParameters }, cb) => {
                socket.emit("produce", { kind, rtpParameters }, cb);
            });

            producerTransport.on("connectionstatechange", (state) => {
                console.log("State: ", state)
                setRtcConnectionState(state)
                // retry if failed
                if (state == "failed" && streamingRef.current == true) {
                    console.log("Retrying");
                    setRtcConnectionState("Restoring connection")
                    socket.emit("resetStream");
                    setupTransport();
                }
            })

            let options: ProducerOptions;
            switch (codec) {
                case "VP9":
                    options = {
                        track: videoTrack,
                        codec: {
                            preferredPayloadType: 96,
                            kind: 'video',
                            mimeType: 'video/VP9',
                            clockRate: 90000,
                            parameters: {
                                'x-google-start-bitrate': 1000,
                            },
                        }
                    }
                    break;

                case "VP8":
                    options = {
                        track: videoTrack,
                        codec: {
                            preferredPayloadType: 96,
                            kind: 'video',
                            mimeType: 'video/VP8',
                            clockRate: 90000,
                            parameters: {
                                'x-google-start-bitrate': 1000,
                            },
                        }
                    }
                    break;

                case "AV1":
                    options = {
                        track: videoTrack,
                        codec: {
                            preferredPayloadType: 96,
                            kind: 'video',
                            mimeType: 'video/AV1',
                            clockRate: 90000,
                            parameters: {},
                            rtcpFeedback: [
                                { type: 'nack' },
                                { type: 'nack', parameter: 'pli' },
                                { type: 'ccm', parameter: 'fir' },
                                { type: 'goog-remb' },
                                { type: 'transport-cc' },
                            ],
                        }
                    }
                    break;

                default:
                    console.log("Defaulted back to VP9")
                    options = {
                        track: videoTrack,
                        codec: {
                            preferredPayloadType: 96,
                            kind: 'video',
                            mimeType: 'video/VP9',
                            clockRate: 90000,
                            parameters: {
                                'x-google-start-bitrate': 1000,
                            },
                        }
                    }
                    break;
            }

            await producerTransport.produce(options);
        })
    }, [framerate, codec])

    useEffect(() => {
        let joined = false;

        const onConnected = () => {
            setIsConnected(true)
        }

        const onDisconnected = () => {
            setIsConnected(false);
            joined = false;
            socket.emit("joinroom", roomID, true)
        }

        // média leves

        let device = new Device();
        deviceRef.current = device;

        const onRouterRtpCapabilities = async (capabilities: RtpCapabilities) => {
            console.log(capabilities)
            // setup rtp
            if (device.loaded) {
                device = new Device();
            }
            await device.load({ routerRtpCapabilities: capabilities })
            console.log("Loaded rtp capabilities of server")

            console.log("Ready to start")

        }


        const onViewcount = (viewcount: number) => {
            setViewers(viewcount)
        }

        const onNameChange = (name: string) => {
            setRoomName(name);
        }

        let passWasWrong = false;

        const onWrongPass = () => {
            passWasWrong = true;
            setPasswordError(true);
            setShowModal(true);
        }


        const onAuthRequired = (authNeeded: boolean) => {
            console.log("Auth needed: ", authNeeded)
            if (authNeeded) {
                if (localStorage.getItem("password") != null && passWasWrong == false) {
                    socket.emit("auth", localStorage.getItem("password"))
                    return;
                }
                setShowModal(true)
                return;
            }

            passWasWrong = false;
            setShowModal(false);
            if (joined == false) {
                joined = true
                socket.emit("joinroom", roomID, true)
            }
        }

        const onLimitchanged = (limitFromServer: number) => {
            const savedLimit = localStorage.getItem("viewerLimit")
            if (savedLimit) {
                if (parseInt(savedLimit) != limitFromServer) {
                    socket.emit("setlimit", parseInt(savedLimit));
                    return;
                }
            }
            setViewerLimit(limitFromServer)
        }

        socket.on("require_auth", onAuthRequired);
        socket.on("viewcount", onViewcount)
        socket.on("namechange", onNameChange)
        socket.on("wrongpass", onWrongPass)
        socket.on("limit_changed", onLimitchanged)

        console.log("Joining")

        socket.on("connect", onConnected);
        socket.on("disconnect", onDisconnected);
        socket.on("routerRtpCapabilities", onRouterRtpCapabilities);
        setIsConnected(socket.connected);

        socket.emit("joinroom", roomID, true);
        return () => {
            console.log("Cleaning up")
            producerTransportRef.current?.close();
            socket.emit("leaveroom");
            socket.off("connect", onConnected);
            socket.off("disconnect", onDisconnected);
            socket.off("routerRtpCapabilities", onRouterRtpCapabilities);
            socket.off("viewcount", onViewcount)
            socket.off("namechange", onNameChange)
            socket.off("wrongpass", onWrongPass)
            socket.off("require_auth", onAuthRequired);
            socket.off("limit_changed", onLimitchanged)
        }
    }, [])

    const [streamStarted, setStreamStarted] = useState(false);

    const resetStream = async () => {
        socket.emit("resetStream");

        producerTransportRef.current?.close();
        await setupTransport();
    }

    const stopStreaming = () => {
        socket.emit("resetStream");
        producerTransportRef.current?.close();
        setStreamStarted(false);
        streamingRef.current = false;
    }

    const startStreaming = () => {
        if (producerTransportRef.current == undefined || producerTransportRef.current?.closed == true) {
            setupTransport();
            setStreamStarted(true);
            streamingRef.current = true;
        }
    }


    useEffect(() => {

        if (firstRender.current == true) {
            return;
        }

        if (streamStarted == true) {
            resetStream();
        }
    }, [framerate, codec])

    useEffect(() => {
        firstRender.current = false;
    })

    const [newRoomName, setNewRoomName] = useState(roomName);
    const [linkGreen, setLinkGreen] = useState(false);

    const updateViewerLimit = (newLimit: number) => {
        if (newLimit < 1) {
            setViewerLimit(1);
            return;
        }
        localStorage.setItem("viewerLimit", newLimit.toString())
        socket.emit("setlimit", newLimit);
    }

    return <>
        <div className="streamHostContainer">
            {/* Video preview */}
            <div className="infoPanel">
                {previewStream ? <StreamViewer stream={previewStream}></StreamViewer> : ""}
                <span>Socket connection: {isConnected ? "Connected" : "Disconnected"}</span>
                <span>Rtc connection state: <span className={
                    `${rtcConnectionState == "connecting" ? "loading" : ""
                    }
                    ${rtcConnectionState == "failed" ? "error" : ""
                    }
                    ${rtcConnectionState == "connected" ? "ok" : ""
                    }
                    ${rtcConnectionState == "disconnected" ? "error" : ""
                    }
                    ${rtcConnectionState == "Restoring connection"? "error": ""}
                    `
                }>{rtcConnectionState}</span></span>
                <span className="viewers">Viewers: {viewers}/{viewerLimit}</span>
                <h2>Invite link</h2>
                <span>Click to copy</span>
                <span className={`${linkGreen ? "linkGreen" : ""} inviteLink`} onClick={() => {
                    navigator.clipboard.writeText(`${location.protocol}//${location.host}/view/${roomID}`);
                    setLinkGreen(true)
                    setTimeout(() => {
                        setLinkGreen(false);
                    }, 500);
                }}>{`${location.protocol}//${location.host}/view/${roomID}`}</span>
            </div>
            {/* Config */}
            <div className="settingsPanel">
                <h1>{roomName}</h1>
                <div className="form-group">
                    <button onClick={startStreaming} disabled={streamStarted}>Start</button>
                    <button onClick={resetStream}>Reset</button>
                    <button onClick={stopStreaming} disabled={!streamStarted}>Stop</button>
                </div>
                <div className="form-group">
                    <label htmlFor="fps">Framerate</label>
                    <select name="fps" disabled={streamStarted} value={framerate} onChange={(ev) => { setFramerate(parseInt(ev.target.value)) }}>
                        <option value={15}>15 (Recommended)</option>
                        <option value={30}>30 (Recommended if you need higher fps)</option>
                        <option value={60}>60 (Experimental, not recommended)</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="codec">Codec</label>
                    <select name="codec" disabled={streamStarted} onChange={(ev) => { setCodec(ev.target.value) }}>
                        <option value="VP9">VP9 (Recommended)</option>
                        <option value="VP8">VP8 (Recommended if one of the viewers recieve only blank stream)</option>
                        <option value="AV1">AV1</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="newName">New name for room</label>
                    <input type="text" placeholder="name" value={newRoomName} onChange={(ev) => { setNewRoomName(ev.target.value) }} />
                    <button onClick={() => {
                        socket.emit("setname", newRoomName)
                    }}>Change</button>
                </div>
                <div className="form-group">
                    <label htmlFor="newLimit">Max number of viewers allowed</label>
                    <input type="number" name="newLimit" value={viewerLimit} onChange={(ev) => updateViewerLimit(parseInt(ev.target.value))} />
                </div>
            </div>
        </div>
        {showModal ? <div className="modal_bg">
            <div className="modal">
                <h1>Password required to start stream.</h1>
                {passwordError ? <h2 style={{ color: "red" }}>Wrong password</h2> : ""}
                <div className="form-group" style={{ flexDirection: "column" }}>
                    <label htmlFor="passwd">Password</label>
                    <input type="password" placeholder="Server password" value={password} onChange={(ev) => { setPassword(ev.target.value) }} />
                    <button onClick={() => { socket.emit("auth", password); localStorage.setItem("password", password) }}>Start</button>
                </div>
            </div>
        </div> : ""}
    </>
}

export default Stream;