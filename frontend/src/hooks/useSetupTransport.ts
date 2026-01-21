import { useCallback } from "react";
import socket from "../Socket";
import getStream from "../utils/getStream";
import type { AppData, ProducerOptions, Transport, TransportOptions } from "mediasoup-client/types";
import type { Device } from "mediasoup-client";

interface UseSetupTransportProps {
  deviceRef: React.RefObject<Device | null>;
  producerTransportRef: React.RefObject<Transport | null>;
  framerate: number;
  codec: string;
  setPreviewStream: (stream: MediaStream | undefined) => void;
  setRtcConnectionState: (state: string) => void;
  setStreamStarted: (started: boolean) => void;
  streamingRef: React.RefObject<boolean>;
}

export const useSetupTransport = ({
  deviceRef,
  producerTransportRef,
  framerate,
  codec,
  setPreviewStream,
  setRtcConnectionState,
  setStreamStarted,
  streamingRef,
}: UseSetupTransportProps) => {

  const setupTransport = useCallback(async () => {
    const device = deviceRef.current;

    if (!device) {
      console.error("Something went wrong, device object is empty.");
      return;
    }

    // setup transport
    const stream = await getStream(framerate);
    setPreviewStream(stream);
    const videoTrack = stream?.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks().length > 0 ? stream.getAudioTracks()[0] : null;

    const onEnded = () => {
      console.log("Ended stream by browser");
      setRtcConnectionState("disconnected");
      setStreamStarted(false);
      streamingRef.current = false;
      socket.emit("resetStream");
      producerTransportRef.current?.close();
    };

    videoTrack?.addEventListener("ended", onEnded);
    console.log(videoTrack);

    if (videoTrack) {
      console.log("Added end listener to track: ", videoTrack);
    }

    socket.emit("createProducerTransport", {}, async (params: TransportOptions<AppData>) => {
      let producerTransport = device.createSendTransport(params);
      producerTransportRef.current = producerTransport;

      producerTransport.on("connect", ({ dtlsParameters }, cb) => {
        socket.emit("connectProducerTransport", { dtlsParameters }, cb);
      });

      producerTransport.on("produce", ({ kind, rtpParameters }, cb) => {
        socket.emit("produce", { kind, rtpParameters }, cb);
      });

      producerTransport.on("connectionstatechange", (state) => {
        console.log("State: ", state);
        setRtcConnectionState(state);

        // retry if failed
        if (state === "failed") {
          const retryInterval = setInterval(() => {
            console.log(state, streamingRef.current, socket.connected);
            if (state === "failed" && streamingRef.current === true && socket.connected) {
              console.log("Retrying");
              setRtcConnectionState("Restoring connection");
              socket.emit("resetStream");
              setupTransport();
              producerTransport.removeAllListeners();
              clearInterval(retryInterval);
            }
          }, 1000);
        }
      });

      let options: ProducerOptions;

      switch (codec) {
        case "VP9":
          options = {
            track: videoTrack,
            codec: {
              preferredPayloadType: 96,
              kind: 'video',
              mimeType: 'video/VP9',
              clockRate: 90000,
              parameters: {
                'x-google-start-bitrate': 1000,
              },
            }
          };
          break;

        case "VP8":
          options = {
            track: videoTrack,
            codec: {
              preferredPayloadType: 96,
              kind: 'video',
              mimeType: 'video/VP8',
              clockRate: 90000,
              parameters: {
                'x-google-start-bitrate': 1000,
              },
            }
          };
          break;

        case "AV1":
          options = {
            track: videoTrack,
            codec: {
              preferredPayloadType: 96,
              kind: 'video',
              mimeType: 'video/AV1',
              clockRate: 90000,
              parameters: {},
              rtcpFeedback: [
                { type: 'nack' },
                { type: 'nack', parameter: 'pli' },
                { type: 'ccm', parameter: 'fir' },
                { type: 'goog-remb' },
                { type: 'transport-cc' },
              ],
            }
          };
          break;

        case "H264":
          options = {
            track: videoTrack,
            codec: {
              preferredPayloadType: 96,
              kind: 'video',
              mimeType: 'video/H264',
              clockRate: 90000,
              parameters: {
                'packetization-mode': 1,
                'profile-level-id': '42e01f',
                'level-asymmetry-allowed': 1
              },
              rtcpFeedback: [
                { type: 'nack' },
                { type: 'nack', parameter: 'pli' },
                { type: 'ccm', parameter: 'fir' },
                { type: 'goog-remb' },
                { type: 'transport-cc' }
              ]
            }
          };
          break;

        default:
          console.log("Defaulted back to VP9");
          options = {
            track: videoTrack,
            codec: {
              preferredPayloadType: 96,
              kind: 'video',
              mimeType: 'video/VP9',
              clockRate: 90000,
              parameters: {
                'x-google-start-bitrate': 1000,
              },
            }
          };
          break;
      }

      // if audio track available just send it
      if (audioTrack) {

        await producerTransport.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: false,
            opusMaxAverageBitrate: 128000 // Force 128kbps
          },
          codec: {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            preferredPayloadType: 100,
            channels: 2,
            parameters: {
              // Tells the browser to send stereo
              'sprop-stereo': 1,
              'stereo': 1,
              // Increase bitrate for high-quality music/video audio
              // 128000 (128kbps) is usually the sweet spot for screenshare
              'maxaveragebitrate': 128000,
              // Disable DTX to prevent the audio from "cutting out" during quiet parts
              'usedtx': 0,
              'useinbandfec': 1
            }
          },
        })

      }

      //send video
      await producerTransport.produce(options);

      // emit signal to viewers
      socket.emit("ready2view");

    });
  }, [framerate, codec, deviceRef, producerTransportRef, setPreviewStream, setRtcConnectionState, setStreamStarted, streamingRef]);

  return setupTransport;
};