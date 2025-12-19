import { useEffect } from "react";

const useWakeLock = () => {
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
}

export default useWakeLock;