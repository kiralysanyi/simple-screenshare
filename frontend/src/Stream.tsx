//stream ui and all of its shit

import { useCallback, useEffect, useRef, useState } from "react";
import socket from "./Socket";
import { useParams } from "react-router";
import getStream from "./utils/getStream";
import { Device } from "mediasoup-client";
import type { AppData, RtpCapabilities, Transport, TransportOptions } from "mediasoup-client/types";
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
    const firstRender = useRef(true);
    const savedPassword = useRef<string>(null)

    const [viewers, setViewers] = useState(0);
    const [roomName, setRoomName] = useState("");


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

        socket.emit("createProducerTransport", {}, async (params: TransportOptions<AppData>) => {
            let producerTransport = device.createSendTransport(params);
            producerTransportRef.current = producerTransport;

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
    }, [framerate])

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

            setupTransport();

        }


        const onViewcount = (viewcount: number) => {
            setViewers(viewcount)
        }

        const onNameChange = (name: string) => {
            setRoomName(name);
        }

        const onWrongPass = () => {
            setPasswordError(true);
            setShowModal(true);
        }


        const onAuthRequired = (authNeeded: boolean) => {
            console.log("Auth needed: ", authNeeded)
            if (authNeeded) {
                if (savedPassword.current != null) {
                    socket.emit("auth", savedPassword.current)
                    return;
                }
                setShowModal(true)
                return;
            }

            setShowModal(false);
            if (joined == false) {
                joined = true
                socket.emit("joinroom", roomID, true)
            }
        }

        socket.on("require_auth", onAuthRequired);
        socket.on("viewcount", onViewcount)
        socket.on("namechange", onNameChange)
        socket.on("wrongpass", onWrongPass)

        console.log("Joining")
        socket.emit("joinroom", roomID, true);

        socket.on("connect", onConnected);
        socket.on("disconnect", onDisconnected);
        socket.on("routerRtpCapabilities", onRouterRtpCapabilities);
        setIsConnected(socket.connected);
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
        }
    }, [])


    useEffect(() => {
        (async () => {
            if (firstRender.current == true) {
                return;
            }

            socket.emit("resetStream");

            producerTransportRef.current?.close();
            await setupTransport();

        })()

    }, [framerate])

    useEffect(() => {
        firstRender.current = false;
    })


    const [newRoomName, setNewRoomName] = useState(roomName);
    const [linkGreen, setLinkGreen] = useState(false)

    return <>
        <div className="streamHostContainer">
            {/* Video preview */}
            <div className="infoPanel">
                {previewStream ? <StreamViewer stream={previewStream}></StreamViewer> : ""}
                <span>Connected: {isConnected ? "yes" : "no"}</span>
                <span className="viewers">Viewers: {viewers}</span>
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
                    <label htmlFor="fps">Framerate</label>
                    <select name="fps" value={framerate} onChange={(ev) => { setFramerate(parseInt(ev.target.value)) }}>
                        <option value={15}>15 (Recommended)</option>
                        <option value={30}>30 (Recommended if you need higher fps)</option>
                        <option value={60}>60 (Experimental, not recommended)</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="newName">New name for room</label>
                    <input type="text" placeholder="name" value={newRoomName} onChange={(ev) => { setNewRoomName(ev.target.value) }} />
                    <button onClick={() => {
                        socket.emit("setname", newRoomName)
                    }}>Change</button>
                </div>
            </div>
        </div>
        {showModal ? <div className="modal_bg">
            <div className="modal">
                <h1>Password required to start stream.</h1>
                {passwordError ? <h2 style={{ color: "red" }}>Wrong password</h2> : ""}
                <div className="form-group">
                    <label htmlFor="passwd">Password</label>
                    <input type="password" placeholder="Server password" value={password} onChange={(ev) => { setPassword(ev.target.value) }} />
                    <button onClick={() => { socket.emit("auth", password); savedPassword.current = password }}>Start</button>
                </div>
            </div>
        </div> : ""}
    </>
}

export default Stream;