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

const statusDisplay = document.getElementById("statusDisplay");
statusDisplay.innerHTML = "Waiting for stream";
const socket = io();

socket.on("connect", () => {
    statusDisplay.style.display = "none";
    if (peer.disconnected) {
        peer.reconnect();
    }
})


socket.on("hostleft", () => {
    statusDisplay.style.display = "block";
    statusDisplay.innerHTML = "Waiting for stream"
})

socket.on("disconnect", () => {
    statusDisplay.style.display = "block";
    statusDisplay.innerHTML = "Disconnected from server"
})

peer.on("call", (call) => {
    console.log("Incoming call")
    call.on("stream", (stream) => {
        statusDisplay.style.display = "none";
        console.log("Incoming stream")
        document.getElementById("display").srcObject = stream;
        call.on("close", () => {
            statusDisplay.style.display = "block";
            statusDisplay.innerHTML = "Waiting for stream"
        })

        call.on("error", () => {
            statusDisplay.style.display = "block";
            statusDisplay.innerHTML = "Stream error -_-"
        })
    })

    const stream = new MediaStream();
    call.answer(stream);
})

peer.on("open", () => {
    socket.emit("joinroom", roomID, peer.id, false)
})

