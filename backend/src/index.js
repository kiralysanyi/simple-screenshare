const express = require("express");
const { Server } = require("socket.io");
const fs = require("fs")
const path = require("path");
require('dotenv').config();

if (process.env.ANNOUNCED_IP == undefined) {
  console.error("ANNOUNCED_IP env variable is not defined")
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

const mediasoup = require('mediasoup');

// Global mediasoup state
let worker;
let router;

// --- Initialization Function ---
const createWorkerAndRouter = async () => {
  // 1. Create a Worker
  worker = await mediasoup.createWorker({
    logLevel: 'warn', // Change to 'debug' for detailed logs
    rtcMinPort: process.env.RTC_MIN_PORT ? process.env.RTC_MIN_PORT : 40000,
    rtcMaxPort: process.env.RTC_MAX_PORT ? process.env.RTC_MAX_PORT : 40500
  });

  worker.on('died', () => {
    console.error('mediasoup Worker died, exiting...');
    process.exit(1);
  });

  // 2. Create a Router
  const mediaCodecs = [
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000
      }
    },
    {
      kind: 'video',
      mimeType: 'video/VP9',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000
      }
    }
  ];

  router = await worker.createRouter({ mediaCodecs });

  console.log('mediasoup Worker and Router initialized.');
};

async function createWebRtcTransport() {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: "0.0.0.0", announcedIp: process.env.ANNOUNCED_IP }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    enableSctp: true,
    enableRtx: true,
    numSctpStreams: { OS: 1024, MIS: 1024 },
    maxBitrate: 2000_000
  });



  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    }
  };
}

// Start the server initialization
createWorkerAndRouter().then(() => {
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
      if (rooms[roomid] != undefined) {
        if (rooms[roomid]["viewers"] + 1 > rooms[roomid]["limit"] && isHost != true) {
          console.log("Room full: ", roomid)
          socket.emit("room_full");
          return;
        }
      }

      if (process.env.HOST_PASS_ENABLE == 1 && socket.authenticated == false && isHost == true) {
        socket.once("auth", (pass) => {
          if (pass == process.env.HOST_PASS) {
            socket.authenticated = true;
            socket.emit("require_auth", false);
          } else {
            socket.emit("wrongpass")
          }
        })
        socket.emit("require_auth", true)
        return;
      } else {
        socket.authenticated = true;
        socket.emit("require_auth", false)
      }

      if (isHost != true) {
        socket.join(roomid);
      }

      console.log("Joining room: ", roomid, isHost, socket.id)
      //remove empty rooms
      const cleanUp = () => {
        if (rooms[roomid] == undefined) {
          return;
        }
        if (rooms[roomid]["hostsocket"] == undefined && rooms[roomid]["viewers"] < 1) {
          console.log("Removing empty room: ", roomid)
          delete rooms[roomid];
        }
      }
      socket.roomID = roomid;

      if (!rooms[roomid]) {
        console.log("Creating room")
        rooms[roomid] = {
          roomname: roomid,
          hostsocket: undefined,
          limit: 20,
          viewers: 0,
          producer: undefined,
          consumers: new Map()
        }
      }

      if (isHost == true && rooms[roomid]["hostsocket"] != undefined) {
        socket.emit("hosterror");
        console.log("Host conflict: someone already streaming in room: ", roomid)
        return;
      }

      if (isHost == true && rooms[roomid]["hostsocket"] == undefined) {
        if (process.env.HOST_PASS_ENABLE == 1) {
          if (socket.authenticated == false) {
            socket.emit("error", "Authentication required on this server.")
            return
          }
        }
        rooms[roomid]["hostsocket"] = socket;
        socket.once("disconnect", () => {
          if (!rooms[roomid]) {
            return;
          }
          rooms[roomid]["hostsocket"] = undefined;
          io.to(roomid).emit("hostleft")
          console.log("Host left at: ", new Date().toLocaleTimeString())
          cleanUp();
        })

        socket.once("leaveroom", () => {
          if (!rooms[roomid]) {
            return;
          }
          rooms[roomid]["hostsocket"] = undefined;
          rooms[roomid]["producer"] = undefined
          io.to(roomid).emit("hostleft")
          console.log("Host left at: ", new Date().toLocaleTimeString())
          cleanUp();
        })

        socket.on("resetStream", () => {
          io.to(roomid).emit("hostleft")
          console.log("Host reset at: ", new Date().toLocaleTimeString())
        })

        socket.on("reloadStream", () => {
          io.to(roomid).emit("ready2view")
        })
      }



      if (isHost != true) {
        // handle new viewer
        rooms[roomid]["viewers"] += 1
        if (rooms[roomid]["hostsocket"]) {
          rooms[roomid]["hostsocket"].emit("viewcount", rooms[roomid]["viewers"]);
        }

        socket.once("disconnect", () => {
          if (!rooms[roomid]) {
            return;
          }

          if (rooms[roomid]["viewers"] > 0) {
            rooms[roomid]["viewers"] -= 1
          }

          if (rooms[roomid]["hostsocket"]) {
            rooms[roomid]["hostsocket"].emit("viewcount", rooms[roomid]["viewers"]);
          }
          cleanUp();
        })

        socket.once("leaveroom", () => {
          if (rooms[roomid]["viewers"] > 0) {
            rooms[roomid]["viewers"] -= 1
          }
          rooms[roomid]["hostsocket"].emit("viewcount", rooms[roomid]["viewers"]);
          cleanUp();
        })

        // send rtp capabilities
        console.log("Sending router capabilities")
        socket.emit('routerRtpCapabilities', router.rtpCapabilities);

        // ===========================
        // Médialeves viewer cucca
        // ===========================

        const onCreateConsumerTransport = async (_, cb) => {
          console.log("createConsumerTransport")
          const { transport, params } = await createWebRtcTransport();
          socket.once("disconnect", () => {
            transport.close();
            if (rooms[roomid]) {
              rooms[roomid]["consumers"].delete(socket.id);
            }
          })
          socket.once("leaveroom", () => {
            if (rooms[roomid]) {
              console.log("Deleted consumer: ", socket.id)
              rooms[roomid]["consumers"].delete(socket.id);
            }
            transport.close();
          })
          rooms[roomid]["consumers"].set(socket.id, transport);
          cb(params);
        }

        const onConnectConsumerTransport = async ({ dtlsParameters }, cb) => {
          try {
            const t = rooms[roomid]["consumers"].get(socket.id);
            await t.connect({ dtlsParameters });
            cb();
          } catch (error) {
            console.error("Connect consumer error: ", error)
          }

        }

        const onConsume = async ({ rtpCapabilities }, cb) => {
          if (!rooms[roomid]["producer"]) {
            cb({ error: "no producer" });
            return;
          }

          if (!router.canConsume({ producerId: rooms[roomid]["producer"].id, rtpCapabilities })) {
            cb({ error: "cant consume" });
            return;
          }

          const transport = rooms[roomid]["consumers"].get(socket.id);
          const consumer = await transport.consume({
            producerId: rooms[roomid]["producer"].id,
            rtpCapabilities,
            paused: false
          });

          cb({
            id: consumer.id,
            producerId: rooms[roomid]["producer"].id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters
          });
        }

        socket.on("createConsumerTransport", onCreateConsumerTransport);
        socket.on("connectConsumerTransport", onConnectConsumerTransport);
        socket.on("consume", onConsume);

        socket.once("leaveroom", () => {
          socket.off("createConsumerTransport", onCreateConsumerTransport);
          socket.off("connectConsumerTransport", onConnectConsumerTransport);
          socket.off("consume", onConsume);
        })

        socket.emit("ready2view")

      }

      //attach host related event handlers
      if (isHost == true) {
        socket.join(roomid)

        const onSetname = (name) => {
          rooms[roomid]["roomname"] = name;
          io.to(roomid).emit("namechange", name)
        }

        const onSetlimit = (limit) => {
          rooms[roomid]["limit"] = limit;
          socket.emit("limit_changed", limit)
        }

        socket.on("setname", onSetname)
        socket.on("setlimit", onSetlimit)

        socket.once("leaveroom", () => {
          socket.on("setname", onSetname)
          socket.on("setlimit", onSetlimit)
        })

        socket.emit("limit_changed", rooms[roomid]["limit"])

        // még több médialeves

        let videoTransport;
        // ===========================
        const onCreateProducerTransport = async (_, cb) => {
          const { transport, params } = await createWebRtcTransport();
          videoTransport = transport;
          socket.once("close", () => {
            transport.close();
          })

          socket.once("leaveroom", () => {
            transport.close();
          })

          cb(params);
        }
        // ===========================
        const onConnectProducerTransport = async ({ dtlsParameters }, cb) => {
          await videoTransport.connect({ dtlsParameters });
          cb();
        }
        // ===========================
        const onProduce = async ({ kind, rtpParameters }, cb) => {
          if (rooms[roomid] == undefined) {
            console.error("Failed to add producer to room: room not found")
            socket.emit("error", "Failed to add producer to room: room not found")
            return;
          }
          rooms[roomid]["producer"] = await videoTransport.produce({ kind, rtpParameters });
          cb({ id: rooms[roomid]["producer"].id });
          console.log("Ready to view", roomid, new Date().toLocaleTimeString())
          io.to(roomid).emit("ready2view", "")
        }

        // ===========================
        socket.on("createProducerTransport", onCreateProducerTransport);
        socket.on("connectProducerTransport", onConnectProducerTransport);
        socket.on("produce", onProduce);

        socket.once("leaveroom", () => {
          socket.off("createProducerTransport", onCreateProducerTransport);
          socket.off("connectProducerTransport", onConnectProducerTransport);
          socket.off("produce", onProduce);
        })

        // ===========================

        socket.emit("viewcount", rooms[roomid]["viewers"]);


        // send rtp capabilities
        console.log("Sending router capabilities")
        socket.emit('routerRtpCapabilities', router.rtpCapabilities);

      }
      socket.emit("namechange", rooms[roomid]["roomname"])
    })
  })

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
