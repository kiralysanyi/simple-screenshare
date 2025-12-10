function createRandomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

console.log(location.hash)

if (location.hash === "") {
    location.hash = createRandomString(10);
}

const roomID = location.hash;

// start peerjs

var peer = new Peer({
    host: "/",
    path: "/peerjs/rtc",
    port: location.port
});

peer.on("open", () => {
    const socket = io();

    socket.on("connect", () => {
        peer.on("call", (call) => {
            console.log("Incoming call")
            call.on("stream", (stream) => {
                console.log("Incoming stream")
                document.getElementById("display").srcObject = stream;
            })

            const stream = new MediaStream();
            call.answer(stream);
        })

        socket.emit("joinroom", roomID, peer.id, false)
    })
})

