import { useEffect, useState, type RefObject } from "react";
import socket from "../Socket";
import { Device } from "mediasoup-client";
import type { RtpCapabilities, Transport } from "mediasoup-client/types";

interface initStreamHookProps {
    roomID: string | undefined,
    producerTransportRef: RefObject<Transport|null>,
    deviceRef: RefObject<Device|null>
}

const useInitStream = ({ roomID, producerTransportRef, deviceRef }: initStreamHookProps) => {
    const [isConnected, setIsConnected] = useState(false);
    const [viewers, setViewers] = useState(0);
    const [roomName, setRoomName] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [viewerLimit, setViewerLimit] = useState(20);


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

    return {
        isConnected,
        viewers,
        roomName,
        showModal,
        passwordError,
        viewerLimit,
        setViewerLimit
    }

}

export default useInitStream;