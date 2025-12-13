
const captureScreen = async (framerate: number = 15, width?: number, height?: number) => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: framerate,
                width: width,
                height: height
            },
            audio: false,
        });

        return stream;
    } catch (err) {
        return new MediaStream();
        console.error("User hates permissions or something failed:", err);
    }
}

let stream: MediaStream | undefined;

const getStream = async (framerate: number): Promise<MediaStream> => {
    try {
        if (stream == undefined || stream?.active == false) {
            stream = await captureScreen(framerate);
            return stream;
        } else {
            return stream;
        }
    } catch (error) {
        throw error;
    }
}

export default getStream;