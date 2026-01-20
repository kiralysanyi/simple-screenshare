const express = require("express");
const { Server } = require("socket.io");
const fs = require("fs")
const path = require("path");
require('dotenv').config();

if (process.env.ANNOUNCED_IPS == undefined) {
  console.error("ANNOUNCED_IPS env variable is not defined")
  process.exit(69)
}

const app = express();

let socketOptions = undefined;

if (process.env.NODE_ENV === 'dev') {
  console.log("Dev mode")
  socketOptions = { cors: { origin: "*" } };
  app.use(require('cors')({ origin: "*" }))
}

const server = app.listen(process.env.HTTP_PORT ? process.env.HTTP_PORT : 9000);

const io = new Server(server, socketOptions);

io.on("error", (err) => {
  console.error("Socketio error: ", err)
})

//mediasoup start

const { viewerHandler } = require("./socketHandlers/viewerHandler");
const { createWebRtcTransport, createWorkerAndRouter } = require("./utils/mediasoup");
const { hostHandler } = require("./socketHandlers/hostHandler");

// Start the server initialization
createWorkerAndRouter().then(({ router, worker }) => {
  const rooms = {}

  io.on("connection", (socket) => {
    socket.authenticated = false;

    // handle room list requests
    socket.on("roomlist", () => {
      const data = [];
      for (let i in rooms) {
        data.push({
          id: i,
          roomname: rooms[i]["roomname"],
          viewers: rooms[i]["viewers"],
          limit: rooms[i]["limit"],
        })
      }
      socket.emit("roomlist", data)
    })

    socket.on("joinroom", (roomid, isHost) => {

      // create room if not existing
      if (!rooms[roomid]) {
        console.log("Creating room")
        rooms[roomid] = {
          roomname: roomid,
          hostname: null,
          hostsocket: undefined,
          limit: 20,
          viewers: 0,
          producer: undefined,
          consumers: new Map()
        }
      }

      // check if room full
      if (rooms[roomid] != undefined) {
        if (rooms[roomid]["viewers"] + 1 > rooms[roomid]["limit"] && isHost != true) {
          console.log("Room full: ", roomid)
          socket.emit("room_full");
          return;
        }
      }

      //attach viewer and return

      if (isHost != true) {
        socket.roomid = roomid;
        return viewerHandler(socket, router, rooms)
      }

      if (isHost == true) {
        socket.roomid = roomid
        return hostHandler(socket, rooms, router, io)
      }
    })
  })

  // serve webui if existing

  if (fs.existsSync("public") && fs.existsSync("public/assets")) {
    console.log("Detected public folder, hosting webapp")
    app.use("/", (req, res, next) => {
      if (req.url.includes("/assets/")) {
        return next();
      }
      return res.sendFile(path.join(process.cwd(), "public", "index.html"))
    })
    app.use("/assets", express.static("public/assets"))
  }
});