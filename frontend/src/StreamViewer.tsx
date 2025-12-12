import { useEffect, useRef } from "react";

const StreamViewer = ({ stream }: { stream?: MediaStream }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!videoRef.current) return;
        if (!stream) return;

        videoRef.current.srcObject = stream;

        console.log("Playing stream", stream)

        videoRef.current.play();

    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", background: "#000" }}
        />
    )
}

export default StreamViewer;