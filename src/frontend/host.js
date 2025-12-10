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

const invite_link = `${location.protocol + "//"}${location.host}/view.html${roomID}`

document.getElementById("invite_link").innerHTML = invite_link;
document.getElementById("invite_link").addEventListener("click", () => {

})

// start peerjs

var peer = new Peer({
    host: "/",
    path: "/peerjs/rtc",
    port: location.port
});

async function captureScreen() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        });

        return stream;
    } catch (err) {
        console.error("User hates permissions or something failed:", err);
    }
}

peer.on("open", () => {
    captureScreen().then((stream) => {
        document.getElementById("display").srcObject = stream;
        const sendStream = (peerid) => {
            console.log("Calling peer: ", peerid)
            let call = peer.call(peerid, stream)
        }

        const socket = io();

        socket.on("connect", () => {
            socket.on("peers", (peers) => {
                for (let i in peers) {
                    sendStream(peers[i]);
                }
            })

            socket.on("newPeer", (peer) => {
                sendStream(peer);
            })

            socket.emit("joinroom", roomID, peer.id, true)
        })
    }).catch(() => {
        console.error("Ki van a faszom.")
        window.alert("Valami hiba van a mátrixban.")
    })
})

