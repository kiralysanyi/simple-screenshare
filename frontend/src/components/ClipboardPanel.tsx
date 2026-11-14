import { useCallback, useEffect, useRef, useState } from "react";
import socket from "../Socket";
import type { DataConsumer, DataProducer, SctpStreamParameters, Transport } from "mediasoup-client/types";

const CHUNK_SIZE = 16 * 1024;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

type ClipboardPanelProps = {
    isHost: boolean;
    transport?: Transport;
    visible?: boolean;
};

type IncomingFile = {
    name: string;
    mime: string;
    size: number;
    chunks: ArrayBuffer[];
    received: number;
};

const ClipboardPanel = ({ isHost, transport, visible = true }: ClipboardPanelProps) => {
    const [text, setText] = useState("");
    const [file, setFile] = useState<{ name: string; url: string }>();
    const [status, setStatus] = useState("Waiting for stream");
    const [dataChannelReady, setDataChannelReady] = useState(false);
    const dataProducerRef = useRef<DataProducer | undefined>(undefined);
    const dataConsumerRef = useRef<DataConsumer | undefined>(undefined);
    const clipboardProducerIdRef = useRef<string | undefined>(undefined);
    const currentTextRef = useRef<string | undefined>(undefined);
    const currentFileRef = useRef<File | undefined>(undefined);
    const incomingFileRef = useRef<IncomingFile | undefined>(undefined);

    function handleMessage(message: ArrayBuffer | string) {
        if (typeof message !== "string") {
            // File chunks follow a file-start message and are reassembled in order.
            const incoming = incomingFileRef.current;
            if (!incoming) return;
            incoming.chunks.push(message);
            incoming.received += message.byteLength;
            return;
        }

        const payload = JSON.parse(message) as { type: string; text?: string; name?: string; mime?: string; size?: number };
        if (payload.type === "text") {
            setText(payload.text ?? "");
            setStatus("Text received");
        } else if (payload.type === "file-start" && payload.name && payload.mime && payload.size !== undefined) {
            incomingFileRef.current = { name: payload.name, mime: payload.mime, size: payload.size, chunks: [], received: 0 };
            setStatus("Receiving file");
        } else if (payload.type === "file-end") {
            const incoming = incomingFileRef.current;
            if (!incoming || incoming.received !== incoming.size) {
                setStatus("Incomplete file received");
                return;
            }
            const url = URL.createObjectURL(new Blob(incoming.chunks, { type: incoming.mime }));
            setFile((previous) => {
                if (previous) URL.revokeObjectURL(previous.url);
                return { name: incoming.name, url };
            });
            incomingFileRef.current = undefined;
            setStatus("File received");
        }
    }

    useEffect(() => {
        if (isHost) {
            if (!transport || transport.closed || dataProducerRef.current) return;

            transport.produceData({
                label: "stream-clipboard",
                protocol: "simple-screenshare-clipboard",
                ordered: true
            }).then((dataProducer) => {
                dataProducerRef.current = dataProducer;
                setDataChannelReady(true);
                setStatus("Ready");
            }).catch((error) => {
                console.error("Failed to create clipboard data channel:", error);
                setStatus("Clipboard unavailable");
            });

            return () => {
                dataProducerRef.current?.close();
                dataProducerRef.current = undefined;
                setDataChannelReady(false);
            };
        }

        const consumeProducer = (producerId: string) => {
            if (!transport || transport.closed || dataConsumerRef.current) return;
            socket.emit("consumeData", { dataProducerId: producerId }, (params: { error?: string; id?: string; dataProducerId?: string; sctpStreamParameters?: SctpStreamParameters; label?: string; protocol?: string }) => {
                if (params.error || !params.id || !params.dataProducerId || !params.sctpStreamParameters) {
                    setStatus(params.error ?? "Clipboard unavailable");
                    return;
                }
                transport.consumeData({
                    id: params.id,
                    dataProducerId: params.dataProducerId,
                    sctpStreamParameters: params.sctpStreamParameters,
                    label: params.label,
                    protocol: params.protocol
                }).then((dataConsumer) => {
                    dataConsumer.binaryType = "arraybuffer";
                    dataConsumer.on("message", handleMessage);
                    dataConsumerRef.current = dataConsumer;
                    setStatus("Ready");
                }).catch((error) => {
                    console.error("Failed to consume clipboard:", error);
                    setStatus("Clipboard unavailable");
                });
            });
        };

        // The producer announcement can arrive before the consumer transport callback.
        const onProducer = (producer: { id: string }) => {
            clipboardProducerIdRef.current = producer.id;
            consumeProducer(producer.id);
        };

        socket.on("clipboardProducer", onProducer);
        if (clipboardProducerIdRef.current) {
            consumeProducer(clipboardProducerIdRef.current);
        }
        return () => {
            socket.off("clipboardProducer", onProducer);
            dataConsumerRef.current?.close();
            dataConsumerRef.current = undefined;
        };
    }, [isHost, transport]);

    const send = useCallback((message: string | ArrayBuffer) => {
        if (dataProducerRef.current?.readyState === "open") {
            dataProducerRef.current.send(message);
        }
    }, []);

    const sendText = useCallback(() => {
        currentTextRef.current = text;
        send(JSON.stringify({ type: "text", text }));
    }, [send, text]);

    const sendFile = useCallback(async (selectedFile: File) => {
        if (selectedFile.size > MAX_FILE_SIZE) {
            setStatus("Files must be 100 MB or smaller");
            return;
        }
        currentFileRef.current = selectedFile;
        send(JSON.stringify({
            type: "file-start",
            name: selectedFile.name,
            mime: selectedFile.type || "application/octet-stream",
            size: selectedFile.size
        }));
        for (let offset = 0; offset < selectedFile.size; offset += CHUNK_SIZE) {
            send(await selectedFile.slice(offset, offset + CHUNK_SIZE).arrayBuffer());
            while ((dataProducerRef.current?.bufferedAmount ?? 0) > 1024 * 1024) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
        }
        send(JSON.stringify({ type: "file-end" }));
        setStatus("File shared");
    }, [send]);

    useEffect(() => {
        return () => {
            if (file) URL.revokeObjectURL(file.url);
        };
    }, [file]);

    useEffect(() => {
        if (!isHost) return;
        const resend = () => {
            if (currentTextRef.current !== undefined) send(JSON.stringify({ type: "text", text: currentTextRef.current }));
            if (currentFileRef.current) void sendFile(currentFileRef.current);
        };
        socket.on("clipboardViewerReady", resend);
        return () => {
            socket.off("clipboardViewerReady", resend);
        };
    }, [isHost, send, sendFile]);

    return (
        <section className={`clipboardPanel ${!isHost && !visible ? "hidden" : ""}`}>
            <h2>Stream clipboard</h2>
            <span>{status}</span>
            {isHost ? <>
                <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Share text with viewers" />
                <button onClick={sendText} disabled={!dataChannelReady}>Share text</button>
                <input type="file" onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) void sendFile(selected);
                }} disabled={!dataChannelReady} />
            </> : <>
                <textarea value={text} readOnly placeholder="Shared text appears here" />
                {file ? <a href={file.url} download={file.name}>Download {file.name}</a> : null}
            </>}
        </section>
    );
};

export default ClipboardPanel;
