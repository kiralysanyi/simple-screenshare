import { useEffect, useRef } from "react";

const StreamViewer = ({ stream, className, audioStream, muted }: { stream?: MediaStream, className?: string, audioStream?: MediaStream, muted: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (!videoRef.current) return;
        if (!stream) return;

        videoRef.current.srcObject = stream;

        console.log("Playing stream", stream)

        videoRef.current.play();

    }, [stream]);

    useEffect(() => {
        if (!audioRef.current) return;
        if (!audioStream) return;

        audioRef.current.srcObject = audioStream;

        if (!muted) {
            console.log("Playing stream", audioStream)
            audioRef.current.play();
        } else {
            audioRef.current.pause();
        }

    }, [audioStream, muted])

    return (
        <div className={className}>
            <audio ref={audioRef} style={{ display: "none" }}></audio>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={className}
                style={{ width: "100%", background: "#000" }}
            />
        </div>
    )
}

export default StreamViewer;