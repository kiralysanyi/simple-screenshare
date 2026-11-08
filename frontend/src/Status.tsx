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
        <div className="header"><h1>Status</h1></div>
        <div className="status-grid">
            <section className="status-card">
                <span className="status-label">Network usage</span>
                <strong>{inbound}</strong>
                <small>Inbound</small>
                <strong>{outbound}</strong>
                <small>Outbound</small>
            </section>
            <section className="status-card">
                <span className="status-label">Resource usage</span>
                <strong>{cpu}</strong>
                <small>CPU</small>
                <strong>{memory}</strong>
                <small>Memory</small>
            </section>
        </div>
        <section className="status-rooms">
        <h2>Current streams</h2>
        <div className="streamList">
            {roomlist ? roomlist.map(room => <div onClick={() => { navigate(`/view/${room.id}`) }} className="streamListItem">
                <h2>{room.roomname}</h2>
                <span>Streamed by: <span>{room.hostname ? room.hostname : "Unknown"}</span></span>
                <span>Viewers: {room.viewers}/{room.limit}</span>
            </div>) : ""}
        </div>
        </section>
    </div>
}

export default StatusPage;