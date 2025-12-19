import { useEffect, useState } from "react";
import { useParams } from "react-router";
import StreamViewer from "./StreamViewer";
import "./css/view.css"
import StatusIndicator from "./StatusIndicator";
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, InformationCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import useViewStream from "./hooks/useViewStream";


const View = () => {

    const roomID = useParams()["id"];
    const [showStats, setShowStats] = useState(false);

    const {
        roomFull,
        rtpStats,
        status,
        statusMessage,
        stream
    } = useViewStream({roomID});


    // fullscreen/controls handler
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);

    useEffect(() => {
        function onFullscreenChange() {
            setIsFullscreen(Boolean(document.fullscreenElement));
        }

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

        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener("mousemove", onMouseMove);

        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener("mousemove", onMouseMove);
            document.exitFullscreen();
        }
    }, [])

    const toggleFullscreen = () => {
        if (!isFullscreen) {
            document.body.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // wakelock

    useEffect(() => {
        let wakelock: WakeLockSentinel | undefined;

        navigator.wakeLock.request().then((wl) => {
            wakelock = wl;
        })

        return () => {
            if (wakelock) {
                wakelock.release();
            }
        }
    }, [])

    return <>
        {stream ? <StreamViewer className="streamView" stream={stream} /> : ""}
        {roomFull ? <div className="modal_bg"><div className="modal">
            <h1>This room is full, please try again later.</h1>
        </div></div> : ""}
        <div className={`controls ${showControls ? "" : "hidden"}`}>
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