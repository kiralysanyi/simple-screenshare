import { useEffect, useState } from "react";

const useFullscreen = () => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!isFullscreen) {
            document.body.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    useEffect(() => {
        function onFullscreenChange() {
            setIsFullscreen(Boolean(document.fullscreenElement));
        }


        document.addEventListener('fullscreenchange', onFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.exitFullscreen();
        }
    }, [])

    return {
        isFullscreen,
        toggleFullscreen
    }
}

export default useFullscreen;