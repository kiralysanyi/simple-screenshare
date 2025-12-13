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
    //const [password, setPassword] = useState("");
    const [showModal, setShowModal] = useState(false);
    const roomID = useParams()["id"];
    const [previewStream, setPreviewStream] = useState<MediaStream>()
    const [framerate, setFramerate] = useState(15)
    const firstRender = useRef(true);

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
        const onConnected = () => {
            setIsConnected(true)
        }

        const onDisconnected = () => {
            setIsConnected(false)
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
            producerTransportRef.current?.close();
            socket.emit("leaveroom");
            socket.off("connect", onConnected);
            socket.off("disconnect", onDisconnected);
            socket.off("auth_required", onAuthRequired);
            socket.off("routerRtpCapabilities", onRouterRtpCapabilities);
            socket.off("namechange", onNameChange);
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

    //misc event listeners
    const [viewers, setViewers] = useState(0);
    const [roomName, setRoomName] = useState("");
    useEffect(() => {
        const onViewcount = (viewcount: number) => {
            setViewers(viewcount)
        }

        const onNameChange = (name: string) => {
            setRoomName(name);
        }

        socket.on("viewcount", onViewcount)
        socket.on("namechange", onNameChange)

        return () => {
            socket.off("viewcount", onViewcount)
            socket.off("namechange", onNameChange)
        }

    }, [])

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
                <span className={`${linkGreen? "linkGreen": ""} inviteLink`} onClick={() => {
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
                    <input type="text" placeholder="name" value={newRoomName} onChange={(ev) => {setNewRoomName(ev.target.value)}} />
                    <button onClick={() => {
                        socket.emit("setname", newRoomName)
                    }}>Change</button>
                </div>
            </div>
        </div>
        {showModal ? <div className="modal"></div> : ""}
    </>
}

export default Stream;