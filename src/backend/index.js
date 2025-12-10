const express = require("express");
const { ExpressPeerServer } = require("peer");
const { Server } = require("socket.io");

const app = express();

app.get("/", (req, res) => res.redirect("/webui"));

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

io.on("connection", (socket) => {
    socket.on("joinroom", (roomid, peerid, isHost) => {
        console.log(`Joining room: ${roomid} from peerid: ${peerid}`)
        socket.roomID = roomid;

        if (!rooms[roomid]) {
            rooms[roomid] = {
                roomname: roomid,
                hostpeer: undefined,
                hostsocket: undefined,
                peers: []
            }
        }


        if (isHost == true && rooms[roomid]["hostpeer"] == undefined) {
            socket.isHost = true;
            rooms[roomid]["hostpeer"] = peerid;
            rooms[roomid]["hostsocket"] = socket;
            socket.on("disconnect", () => {
                rooms[roomid]["hostpeer"] = undefined;
                rooms[roomid]["hostsocket"] = undefined;
            })

            socket.emit("peers", rooms[roomid]["peers"]);
        } else {
            socket.isHost = false;
        }



        if (isHost != true) {
            rooms[roomid]["peers"].push(peerid)
            io.to(roomid).emit("newPeer", peerid)

            socket.on("disconnect", () => {
                rooms[roomid]["peers"] = rooms[roomid]["peers"].filter(v => v !== peerid);
                rooms[roomid]["hostsocket"].emit("removePeer", peerid)
            })
        }

        if (socket.isHost) {
            socket.on("setname", (name) => {
                rooms[roomid]["roomname"] = name;
                io.to(roomid).emit("namechange", name)
            })
        }

        socket.join(roomid);
        socket.emit("namechange", rooms[roomid]["roomname"])
    })
})

app.use("/peerjs", peerServer)

app.use("/webui", express.static("src/frontend"))

app.get("/api/rooms", (req, res) => {
    const data = [];
    for (let i in rooms) {
        data.push({
            id: i,
            roomname: rooms[i]["roomname"],
            viewers: rooms[i]["peers"].length
        })
    }
    return res.json({
        success: true,
        data: data
    })
})

console.log("http://127.0.0.1:9000")