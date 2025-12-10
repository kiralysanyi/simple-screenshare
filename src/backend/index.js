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

        //remove empty rooms
        const cleanUp = () => {
            if (rooms[roomid] == undefined) {
                return;
            }
            console.log("Socket disconnected")
            console.log(rooms[roomid])
            if (rooms[roomid]["hostpeer"] == undefined && rooms[roomid]["peers"].length == 0) {
                console.log("Removing empty room: ", roomid)
                delete rooms[roomid];
            }
        }
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

        if (isHost == true && rooms[roomid]["hostpeer"] != undefined) {
            socket.emit("hosterror");
            console.log("Host conflict: someone already streaming in room: ", roomid)
            return;
        }

        if (isHost == true && rooms[roomid]["hostpeer"] == undefined) {
            socket.isHost = true;
            rooms[roomid]["hostpeer"] = peerid;
            rooms[roomid]["hostsocket"] = socket;
            socket.on("disconnect", () => {
                rooms[roomid]["hostpeer"] = undefined;
                rooms[roomid]["hostsocket"] = undefined;
                io.to(roomid).emit("hostleft")
                cleanUp();
            })

            socket.emit("peers", rooms[roomid]["peers"]);
        } else {
            socket.isHost = false;
        }



        if (isHost != true) {
            if (!rooms[roomid]["peers"].includes(peerid)) {
                rooms[roomid]["peers"].push(peerid)
            }
            io.to(roomid).emit("newPeer", peerid)

            socket.on("disconnect", () => {
                if (!rooms[roomid]) {
                    return;
                }
                if (rooms[roomid]["hostsocket"]) {
                    rooms[roomid]["hostsocket"].emit("removePeer", peerid);
                }

                rooms[roomid]["peers"] = rooms[roomid]["peers"].filter(v => v !== peerid);
                cleanUp();
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