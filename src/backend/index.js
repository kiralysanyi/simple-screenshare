const express = require("express");
const { ExpressPeerServer } = require("peer");
const { Server } = require("socket.io");

const app = express();

app.get("/", (req, res, next) => res.send("Hello world!"));

// =======

const server = app.listen(9000);

const io = new Server(server);

const peerServer = ExpressPeerServer(server, {
    path: "/rtc",
});

/*
{
    roomid: [peer1, peer2, peer3]
}
*/

const rooms = {}
const peerIDs = {}

io.on("connection", (socket) => {
    socket.on("joinroom", (roomid, peerid, isHost) => {
        console.log(`Joining room: ${roomid} from peerid: ${peerid}`)
        socket.roomID = roomid;

        if (!rooms[roomid]) {
            rooms[roomid] = {}
        }

        if (isHost && rooms[roomid]["hostpeer"] == undefined) {
            rooms[roomid]["hostpeer"] = peerid;
            socket.on("disconnect", () => {
                rooms[roomid]["hostpeer"] = undefined;
            })

            socket.emit("peers", peerIDs[roomid]);
        }

        if (!peerIDs[roomid]) {
            peerIDs[roomid] = [];
        }

        peerIDs[roomid].push(peerid)
        io.to(roomid).emit("newPeer", peerid)
        socket.join(roomid);
    })
})

app.use("/peerjs", peerServer)

app.use("/webui", express.static("src/frontend"))