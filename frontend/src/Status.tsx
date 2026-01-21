import { useEffect, useState } from "react";
import socket from "./Socket";
import type { stats } from "./interfaces/stats";

const StatusPage = () => {
    const [inbound, setInbound] = useState("");
    const [outbound, setOutbound] = useState("");

    const [cpu, setCpu] = useState("");
    const [memory, setMemory] = useState("")

    useEffect(() => {
        const onStats = (data: stats) => {
            setInbound(data.netstat.inKbps + "Kbps")
            setOutbound(data.netstat.outKbps + "Kbps")
            setCpu(data.worker.cpu)
            setMemory(data.worker.memory)
        }

        socket.on("stats", onStats)

        let refreshInterval = setInterval(() => {
            socket.emit("getStats")
        }, 1500);

        return () => {
            socket.off("stats", onStats);
            clearInterval(refreshInterval);
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
    </div>
}

export default StatusPage;