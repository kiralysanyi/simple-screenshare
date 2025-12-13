import { useEffect, useRef } from "react";

const StreamViewer = ({ stream, className }: { stream?: MediaStream, className?: string }) => {
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
            className={className}
            style={{ width: "100%", background: "#000" }}
        />
    )
}

export default StreamViewer;