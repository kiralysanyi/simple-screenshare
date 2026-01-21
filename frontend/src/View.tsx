import { useEffect, useState } from "react";
import { useParams } from "react-router";
import StreamViewer from "./StreamViewer";
import "./css/view.css"
import StatusIndicator from "./StatusIndicator";
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, InformationCircleIcon, SpeakerWaveIcon, SpeakerXMarkIcon, XCircleIcon } from "@heroicons/react/24/solid";
import useViewStream from "./hooks/useViewStream";
import useWakeLock from "./hooks/useWakeLock";
import useFullscreen from "./hooks/useFullscreen";


const View = () => {

    const roomID = useParams()["id"];
    const [showStats, setShowStats] = useState(false);
    const [muted, setMuted] = useState(true);

    const {
        roomFull,
        rtpStats,
        status,
        statusMessage,
        stream,
        hostname,
        roomname,
        audioStream
    } = useViewStream({ roomID });

    // handle fullscreen
    const { isFullscreen, toggleFullscreen } = useFullscreen();

    // handle controls
    const [showControls, setShowControls] = useState(true);

    useEffect(() => {

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

        document.addEventListener("mousemove", onMouseMove);

        return () => {
            document.removeEventListener("mousemove", onMouseMove);
        }
    }, [])

    // wakelock

    useWakeLock();

    return <>
        {stream ? <StreamViewer muted={muted} audioStream={audioStream} className="streamView" stream={stream} /> : ""}
        {roomFull ? <div className="modal_bg"><div className="modal">
            <h1>This room is full, please try again later.</h1>
        </div></div> : ""}
        <div className={`infocard ${showControls ? "" : "hidden"}`}>
            <span><b>Room:</b> {roomname}</span>
            <span><b>Stream by:</b> {hostname ? hostname : "Unknown"}</span>
        </div>
        <div className={`controls ${showControls ? "" : "hidden"}`}>
            {audioStream ? <div className="btn" onClick={() => { setMuted(!muted) }}>
                {muted ? <SpeakerXMarkIcon color="white" width={32} height={32} /> : <SpeakerWaveIcon color="white" width={32} height={32} />}
            </div> : ""}
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