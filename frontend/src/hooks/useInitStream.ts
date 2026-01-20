import { useCallback, useEffect, useState, type RefObject } from "react";
import socket from "../Socket";
import { Device } from "mediasoup-client";
import type { RtpCapabilities, Transport } from "mediasoup-client/types";
import type { room } from "../interfaces/room";

interface initStreamHookProps {
    roomID: string | undefined,
    producerTransportRef: RefObject<Transport | null>,
    deviceRef: RefObject<Device | null>
}

const useInitStream = ({ roomID, producerTransportRef, deviceRef }: initStreamHookProps) => {
    const [isConnected, setIsConnected] = useState(false);
    const [viewers, setViewers] = useState(0);
    const [roomName, setRoomName] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [viewerLimit, setViewerLimit] = useState(20);
    const [hostname, setHostname] = useState("");

    const [finishedInit, setFinishedInit] = useState(false)

    const saveStream = () => {
        // save this stream in history

        let history = localStorage.getItem("streaminghistory");
        let parsedHistory: null | Record<string, room> = null;
        if (history == null || history == "") {
            parsedHistory = {}
        } else {
            parsedHistory = JSON.parse(history)
        }

        if (roomID && parsedHistory) {
            parsedHistory[roomID] = {
                id: roomID,
                roomname: roomName,
                limit: viewerLimit,
                hostname: hostname,
                viewers: 0
            }

            console.log("Saving: ", parsedHistory[roomID])

            localStorage.setItem("streaminghistory", JSON.stringify(parsedHistory))
        }

    }

    // load data from history if possible
    const loadData = useCallback(() => {
        console.log("Loading saved data")
        let history = localStorage.getItem("streaminghistory");
        if (history == null || history == "") {
            return;
        }

        let parsedHistory: Record<string, room> = JSON.parse(history);

        if (roomID && parsedHistory[roomID]) {
            const roomData = parsedHistory[roomID];
            console.log("Loaded: ", roomData)
            setHostname(roomData.hostname ? roomData.hostname : "");
            setRoomName(roomData.roomname);
            socket.emit("setname", roomData.roomname)
            socket.emit("hostname", roomData.hostname)
            setViewerLimit(roomData.limit);
        }

    }, [])

    useEffect(() => {
        if (!finishedInit) {
            return
        }
        saveStream();
    }, [hostname, roomName, viewerLimit, finishedInit])

    useEffect(() => {
        let joined = false;

        const onConnected = () => {
            socket.once("roomname", () => {
                loadData();
                setFinishedInit(true);
            })
            setIsConnected(true)
        }

        const onDisconnected = () => {
            setFinishedInit(false);
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
        socket.on("roomname", onNameChange)

        socket.once("roomname", () => {
            loadData();
            setFinishedInit(true);
        })

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

    return {
        isConnected,
        viewers,
        roomName,
        showModal,
        passwordError,
        viewerLimit,
        setViewerLimit,
        setHostname,
        hostname
    }

}

export default useInitStream;