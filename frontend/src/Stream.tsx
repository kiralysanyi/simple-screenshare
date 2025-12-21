import { useEffect, useRef, useState } from "react";
import socket from "./Socket";
import { useParams } from "react-router";
import { Device } from "mediasoup-client";
import type { Transport } from "mediasoup-client/types";
import StreamViewer from "./StreamViewer";
import { useSetupTransport } from "./hooks/useSetupTransport";
import "./css/streamer.css"
import useInitStream from "./hooks/useInitStream";


const Stream = () => {
    //transport setup start
    const deviceRef = useRef<Device | null>(null);
    const producerTransportRef = useRef<Transport | null>(null);
    const roomID = useParams()["id"];
    const [previewStream, setPreviewStream] = useState<MediaStream>()
    const [framerate, setFramerate] = useState(15)
    const [codec, setCodec] = useState("VP9")
    const [rtcConnectionState, setRtcConnectionState] = useState("disconnected");
    const streamingRef = useRef(false);
    const [streamStarted, setStreamStarted] = useState(false);
    const setupTransport = useSetupTransport({
        deviceRef,
        producerTransportRef,
        framerate,
        codec,
        setPreviewStream,
        setRtcConnectionState,
        setStreamStarted,
        streamingRef,
    });

    //transport setup end

    const [password, setPassword] = useState("");

    //init

    const {
        isConnected,
        passwordError,
        roomName,
        setViewerLimit,
        showModal,
        viewerLimit,
        viewers
    } = useInitStream({ roomID, producerTransportRef, deviceRef })

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

    //load saved config

    useEffect(() => {
        const savedFramerate = localStorage.getItem("framerate");
        let savedCodec = localStorage.getItem("codec");

        console.log("Loading: ", savedFramerate, savedCodec)

        if (savedCodec != "H264" && savedCodec != "VP8" && savedCodec != "VP9" && savedCodec != "AV1") {
            console.log("Invalid codec in config: ", savedCodec)
            savedCodec = "VP9"
        }

        savedFramerate ? setFramerate(parseInt(savedFramerate)) : null;
        savedCodec ? setCodec(savedCodec) : null;
    }, [])

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
                    ${rtcConnectionState == "Restoring connection" ? "error" : ""}
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
                    <select name="fps" disabled={streamStarted} value={framerate} onChange={(ev) => { setFramerate(parseInt(ev.target.value)); localStorage.setItem("framerate", ev.target.value) }}>
                        <option value={15}>15 (Recommended)</option>
                        <option value={30}>30 (Recommended if you need higher fps)</option>
                        <option value={60}>60 (Experimental, not recommended)</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="codec">Codec</label>
                    <select name="codec" value={codec} disabled={streamStarted} onChange={(ev) => { setCodec(ev.target.value); localStorage.setItem("codec", ev.target.value); }}>
                        <option value="VP9">VP9 (Recommended)</option>
                        <option value="VP8">VP8</option>
                        <option value="AV1">AV1</option>
                        <option value="H264">H264</option>
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