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
const { createWorkerAndRouter } = require("./utils/mediasoup");
const { hostHandler } = require("./socketHandlers/hostHandler");

// Start the server initialization
createWorkerAndRouter().then(async ({ router, worker }) => {
  // get worker process stats
  let last = await worker.getResourceUsage();
  let lastTs = Date.now();

  let usageStats;

  setInterval(async () => {
    const now = await worker.getResourceUsage();
    const nowTs = Date.now();

    const cpuTimeDelta =
      (now.ru_utime + now.ru_stime) -
      (last.ru_utime + last.ru_stime);

    const wallTimeDelta = (nowTs - lastTs) * 1000; // ms -> µs

    const cpuPercent = (cpuTimeDelta / wallTimeDelta) * 100;

    const memoryMB = now.ru_maxrss / 1024;

    usageStats = {
      cpu: cpuPercent.toFixed(5) + "%",
      memory: memoryMB.toFixed(1) + " MB",
      ctxSwitches: now.ru_nivcsw
    };

    last = now;
    lastTs = nowTs;
  }, 1000);

  // get network stats

  let lastIn = 0;
  let lastOut = 0;

  let netstat;

  setInterval(async () => {
    let totalIn = 0;
    let totalOut = 0;

    for (const room of Object.values(rooms)) {
      // Consumers = outgoing traffic from server
      for (const consumer of room.consumers.values()) {
        const stats = await consumer.getStats();
        for (let i in stats) {
          let s = stats[i]
          if (typeof s.bytesSent === "number") {
            totalOut += s.bytesSent;
          }
        }
      }

      // Producer = incoming traffic to server
      if (room.producer) {
        const stats = await room.producer.getStats();
        for (const s of stats) {
          if (typeof s.byteCount === "number") {
            totalIn += s.byteCount;
          }
        }
      }
    }

    const deltaIn = totalIn - lastIn;
    const deltaOut = totalOut - lastOut;

    lastIn = totalIn;
    lastOut = totalOut;

    netstat = {
      inKbps: (deltaIn * 8 / 1000).toFixed(1),
      outKbps: (deltaOut * 8 / 1000).toFixed(1)
    }
  }, 1000);


  const rooms = {}

  setInterval(() => {
    // broadcast stats
    const stats = {
      worker: usageStats,
      netstat
    }

    io.to("statviewers").emit("stats", stats)

    // broadcast roomlist
    const data = [];
    for (let i in rooms) {
      data.push({
        id: i,
        roomname: rooms[i]["roomname"],
        viewers: rooms[i]["viewers"],
        limit: rooms[i]["limit"],
        hostname: rooms[i]["hostname"]
      })
    }

    io.to("roomlist").emit("roomlist", data)
  }, 1000);

  io.on("connection", (socket) => {
    socket.authenticated = false;

    // handle status requests

    socket.on("joinStats", () => {
      socket.join("statviewers")
    })

    socket.on("joinRoomlist", () => {
      socket.join("roomlist")
    })

    socket.on("leaveall", () => {
      socket.rooms.forEach((room) => {
        socket.leave(room)
      })
    })

    // handle room list requests
    socket.on("roomlist", () => {
      const data = [];
      for (let i in rooms) {
        data.push({
          id: i,
          roomname: rooms[i]["roomname"],
          viewers: rooms[i]["viewers"],
          limit: rooms[i]["limit"],
          hostname: rooms[i]["hostname"]
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
          audioProducer: undefined,
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