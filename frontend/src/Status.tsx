import { useEffect, useState } from "react";
import socket from "./Socket";
import type { stats } from "./interfaces/stats";
import type { room } from "./interfaces/room";
import { useNavigate } from "react-router";

const StatusPage = () => {
    const [inbound, setInbound] = useState("");
    const [outbound, setOutbound] = useState("");

    const [cpu, setCpu] = useState("");
    const [memory, setMemory] = useState("");

    const [roomlist, setRoomlist] = useState<Array<room>>()

    const navigate = useNavigate();

    useEffect(() => {
        document.title = "Screenshare stats"

        const onStats = (data: stats) => {
            let tOut = data.netstat.outKbps > 1000 ? (data.netstat.outKbps / 1000).toFixed(2) + "Mbps" : data.netstat.outKbps + "Kbps"
            let tIn = data.netstat.inKbps > 1000 ? (data.netstat.inKbps / 1000).toFixed(2) + "Mbps" : data.netstat.inKbps + "Kbps"

            setInbound(tIn)
            setOutbound(tOut)
            setCpu(data.worker.cpu)
            setMemory(data.worker.memory)
        }

        const onList = (rooms: Array<room>) => {
            setRoomlist(rooms);
        }

        socket.on("stats", onStats)
        socket.on("roomlist", onList)
        socket.emit("joinStats")
        socket.emit("joinRoomlist")
        socket.emit("roomlist")

        return () => {
            socket.off("stats", onStats);
            socket.off("roomlist", onList)
            socket.emit("leaveall")
        }
    }, [])

    return <div className="main">
        <h1>Status</h1>

        <div className="separator"></div>

        <h2>Network usage</h2>
        <span>Inbound: {inbound}</span>
        <span>Outbound: {outbound}</span>

        <div className="separator"></div>

        <h2>Resource usage</h2>
        <span>CPU: {cpu}</span>
        <span>Memory: {memory}</span>
        <div className="separator"></div>

        <h2>Current streams / rooms</h2>
        <div className="streamList">
            {roomlist ? roomlist.map(room => <div onClick={() => { navigate(`/view/${room.id}`) }} className="streamListItem">
                <h2>{room.roomname}</h2>
                <span>Streamed by: <span>{room.hostname ? room.hostname : "Unknown"}</span></span>
                <span>Viewers: {room.viewers}/{room.limit}</span>
            </div>) : ""}
        </div>
    </div>
}

export default StatusPage;