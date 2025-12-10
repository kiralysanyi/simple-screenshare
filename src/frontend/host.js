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

const invite_link = `${location.protocol + "//"}${location.host}/webui/view.html${roomID}`

document.getElementById("invite_link").innerHTML = invite_link;
document.getElementById("invite_link").addEventListener("click", () => {
    navigator.clipboard.writeText(invite_link);
    document.getElementById("invite_link").style.backgroundColor = "green";
    setTimeout(() => {
        document.getElementById("invite_link").style.backgroundColor = "rgba(0, 0, 0, 0.6)";
    }, 1000);
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

function updateViewerList(peers) {
    console.log("Viewer list updated: ", peers);
    document.getElementById("viewcount").innerHTML = peers.length;
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
            socket.once("peers", (peers) => {
                for (let i in peers) {
                    sendStream(peers[i]);
                }

                updateViewerList(peers);

                socket.on("removePeer", (peerToRemove) => {
                    peers = peers.filter(v => v !== peerToRemove)
                    updateViewerList(peers)
                })

                socket.on("newPeer", (peer) => {
                    peers.push(peer);
                    updateViewerList(peers);
                    sendStream(peer);
                })
            })

            socket.on("namechange", (name) => {
                document.getElementById("roomname").innerText = name;
            })

            socket.once("hosterror", () => {
                window.alert("There is someone already streaming in this room.")
            })

            socket.emit("joinroom", roomID, peer.id, true)
        })

        document.getElementById("changename").addEventListener("click", () => {
            const newnameInput = document.getElementById("newname")
            socket.emit("setname", newnameInput.value);
            newnameInput.value = "";
        })
    }).catch(() => {
        console.error("Ki van a faszom.")
        window.alert("Valami hiba van a mátrixban.")
    })
})

