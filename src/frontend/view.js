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

function hideStatus() {
    statusDisplay.style.display = "none";
    document.getElementById("display").style.display = "block";
    document.body.style.backgroundImage = "none";
}

function updateStatus(status) {
    statusDisplay.innerHTML = status;
    statusDisplay.style.display = "block";
    document.getElementById("display").style.display = "none";
    document.body.style.backgroundImage = `url("background.jpg")`;
}

updateStatus("Waiting for stream")
const socket = io();

socket.on("connect", () => {
    statusDisplay.style.display = "none";
    if (peer.disconnected) {
        peer.reconnect();
    }
})


socket.on("hostleft", () => {
    updateStatus("Waiting for stream")
})

socket.on("disconnect", () => {
    updateStatus("Disconnected from server")
})

peer.on("call", (call) => {
    console.log("Incoming call")
    call.on("stream", (stream) => {
        hideStatus();
        console.log("Incoming stream")
        document.getElementById("display").srcObject = stream;

        call.on("close", () => {
            updateStatus("Waiting for stream")
        })

        call.on("error", () => {
            updateStatus("Stream error -_-")
        })
    })

    const stream = new MediaStream();
    call.answer(stream);
})

peer.on("open", () => {
    updateStatus("Waiting for stream");
    socket.emit("joinroom", roomID, peer.id, false)
})

