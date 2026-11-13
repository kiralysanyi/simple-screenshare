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
const { createWorkersAndRouters } = require("./utils/mediasoup");
const { hostHandler } = require("./socketHandlers/hostHandler");

// Start the server initialization
createWorkersAndRouters().then(async ({ routers, workers }) => {
  let nextRouter = 0;

  const selectRouter = () => {
    const router = routers[nextRouter];
    nextRouter = (nextRouter + 1) % routers.length;
    return router;
  };

  // get worker process stats
  const previousWorkerUsage = workers.map(() => undefined);
  const previousWorkerTimestamp = workers.map(() => undefined);
  let usageStats;

  const collectWorkerStats = async () => {
    const nowTimestamp = Date.now();
    const workerStats = await Promise.all(workers.map(async (worker, index) => {
      const usage = await worker.getResourceUsage();
      const previousUsage = previousWorkerUsage[index];
      const previousTimestamp = previousWorkerTimestamp[index];
      const wallTimeMicroseconds = previousTimestamp
        ? (nowTimestamp - previousTimestamp) * 1000
        : 0;
      const cpuTimeMicroseconds = previousUsage
        ? (usage.ru_utime + usage.ru_stime) -
        (previousUsage.ru_utime + previousUsage.ru_stime)
        : 0;

      previousWorkerUsage[index] = usage;
      previousWorkerTimestamp[index] = nowTimestamp;

      return {
        worker: index,
        cpu: wallTimeMicroseconds > 0
          ? ((cpuTimeMicroseconds / wallTimeMicroseconds) * 100).toFixed(2) + "%"
          : "0.00%",
        memory: (usage.ru_maxrss / 1024).toFixed(1) + " MB",
        ctxSwitches: usage.ru_nivcsw
      };
    }));

    usageStats = {
      cpu: workerStats.reduce((total, stats) =>
        total + Number.parseFloat(stats.cpu), 0).toFixed(2) + "%",
      memory: workerStats.reduce((total, stats) =>
        total + Number.parseFloat(stats.memory), 0).toFixed(1) + " MB",
      ctxSwitches: workerStats.reduce((total, stats) =>
        total + stats.ctxSwitches, 0)
    };
  };

  setInterval(() => {
    collectWorkerStats().catch((error) => {
      console.error("Failed to collect worker stats:", error);
    });
  }, 5000);

  // get network stats

  let netstat;
  const previousProducerBytes = new Map();
  const previousConsumerBytes = new Map();

  const collectNetworkStats = async () => {
    let totalIn = 0;
    let totalOut = 0;
    const activeProducerIds = new Set();
    const activeConsumerIds = new Set();
    const producerRequests = [];
    const consumerRequests = [];

    for (const room of Object.values(rooms)) {
      // Consumers = outgoing traffic from server
      for (const consumer of room.consumers.values()) {
        activeConsumerIds.add(consumer.id);
        consumerRequests.push(consumer.getStats().then((stats) => ({
          id: consumer.id,
          bytes: stats.reduce((total, report) =>
            total + (typeof report.bytesSent === "number" ? report.bytesSent : 0), 0)
        })));
      }

      for (const producer of [room.producer, room.audioProducer]) {
        if (producer) {
          activeProducerIds.add(producer.id);
          producerRequests.push(producer.getStats().then((stats) => ({
            id: producer.id,
            bytes: stats.reduce((total, report) =>
              total + (typeof report.byteCount === "number" ? report.byteCount : 0), 0)
          })));
        }
      }
    }

    const [producers, consumers] = await Promise.all([
      Promise.all(producerRequests),
      Promise.all(consumerRequests)
    ]);

    for (const { id, bytes } of producers) {
      const previous = previousProducerBytes.get(id);
      if (previous !== undefined && bytes >= previous) {
        totalIn += bytes - previous;
      }
      previousProducerBytes.set(id, bytes);
    }

    for (const { id, bytes } of consumers) {
      const previous = previousConsumerBytes.get(id);
      if (previous !== undefined && bytes >= previous) {
        totalOut += bytes - previous;
      }
      previousConsumerBytes.set(id, bytes);
    }

    for (const id of previousProducerBytes.keys()) {
      if (!activeProducerIds.has(id)) previousProducerBytes.delete(id);
    }
    for (const id of previousConsumerBytes.keys()) {
      if (!activeConsumerIds.has(id)) previousConsumerBytes.delete(id);
    }

    netstat = {
      inKbps: (totalIn * 8 / 5 / 1000).toFixed(1),
      outKbps: (totalOut * 8 / 5 / 1000).toFixed(1)
    };
  };

  setInterval(() => {
    collectNetworkStats().catch((error) => {
      console.error("Failed to collect network stats:", error);
    });
  }, 5000);


  const rooms = {}

  const getVisibleRoomList = () => Object.entries(rooms)
    .filter(([, room]) => room.hidden !== true)
    .map(([id, room]) => ({
      id,
      roomname: room.roomname,
      viewers: room.viewers,
      limit: room.limit,
      hostname: room.hostname
    }));

  setInterval(() => {
    // broadcast stats
    const stats = {
      worker: usageStats,
      netstat
    }

    io.to("statviewers").emit("stats", stats)

    // broadcast roomlist
    io.to("roomlist").emit("roomlist", getVisibleRoomList())
  }, 5000);

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
      socket.emit("roomlist", getVisibleRoomList())
    })

    socket.on("joinroom", (roomid, isHost) => {
      console.log("Joining")
      if (isHost == true) {
        socket.roomid = roomid
        return hostHandler(socket, rooms, io, selectRouter)
      }

      // create room if not existing
      if (!rooms[roomid]) {
        return socket.emit("room_404")
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
        return viewerHandler(socket, rooms[roomid].router, rooms)
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