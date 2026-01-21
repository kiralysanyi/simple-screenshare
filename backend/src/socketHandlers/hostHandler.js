const { Socket, Server } = require("socket.io");
const { createWebRtcTransport } = require("../utils/mediasoup");

/**
 * @param {Socket} socket
 * @param {Array} rooms
 * @param {import("mediasoup/types").Router} router
 * @param {Server} io
 */
const hostHandler = (socket, rooms, router, io) => {
    const roomid = socket.roomid;
    // authenticate if password enabled, and client joins as host
    if (process.env.HOST_PASS_ENABLE == 1 && socket.authenticated == false) {
        const onAuthHandler = (pass) => {
            if (pass == process.env.HOST_PASS) {
                socket.authenticated = true;
                socket.emit("require_auth", false);
                socket.join(roomid)
            } else {
                socket.emit("wrongpass")
            }
        }

        socket.on("auth", onAuthHandler)
        socket.once("leaveroom", () => { socket.off("auth", onAuthHandler) })
        socket.emit("require_auth", true)
        return;
    } else {
        socket.authenticated = true;
        socket.join(roomid)
        socket.emit("require_auth", false)
    }

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

    // handle stream conflicts, only allow one host to stream
    if (rooms[roomid]["hostsocket"] != undefined) {
        socket.emit("hosterror");
        console.log("Host conflict: someone already streaming in room: ", roomid)
        return;
    }

    if (rooms[roomid]["hostsocket"] == undefined) {
        // setup host
        rooms[roomid]["hostsocket"] = socket;
        socket.once("disconnect", () => {
            if (!rooms[roomid]) {
                return;
            }
            rooms[roomid]["hostsocket"] = undefined;
            rooms[roomid]["audioProducer"] = undefined;
            io.to(roomid).emit("hostleft")
            console.log("Host left at: ", new Date().toLocaleTimeString())
            cleanUp();
        })

        socket.once("leaveroom", () => {
            if (!rooms[roomid]) {
                return;
            }
            rooms[roomid]["hostsocket"] = undefined;
            rooms[roomid]["producer"] = undefined;
            rooms[roomid]["audioProducer"] = undefined;
            io.to(roomid).emit("hostleft")
            console.log("Host left at: ", new Date().toLocaleTimeString())
            cleanUp();
        })

        const onResetStream = () => {
            rooms[roomid]["producer"] = undefined;
            rooms[roomid]["audioProducer"] = undefined;
            io.to(roomid).emit("resetStream")
            console.log("Host reset at: ", new Date().toLocaleTimeString())
        }

        socket.on("resetStream", onResetStream)

        const onReloadStream = () => {
            io.to(roomid).emit("ready2view")
        }

        socket.once("leaveroom", () => {
            socket.off("resetStream", onResetStream)
            socket.off("reloadStream", onReloadStream)
            socket.leave(roomid)
        })
    }



    const onSetname = (name) => {
        console.log(`[${socket.roomid}]new room name: `, name)
        if (rooms[roomid]) {
            rooms[roomid]["roomname"] = name;
        }
        io.to(roomid).emit("roomname", name)
    }

    const onSetlimit = (limit) => {
        if (!rooms[roomid]) {
            socket.emit("error", "room not found");
            return;
        }
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
        const { transport, params } = await createWebRtcTransport(router);
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
        try {
            if (kind == "video") {
                rooms[roomid]["producer"] = await videoTransport.produce({ kind, rtpParameters });
                cb({ id: rooms[roomid]["producer"].id });
                console.log("Ready to view", roomid, new Date().toLocaleTimeString())
                io.to(roomid).emit("ready2view")
            } else {
                rooms[roomid]["audioProducer"] = await videoTransport.produce({ kind, rtpParameters });
                cb({ id: rooms[roomid]["audioProducer"].id });
                console.log("Audio ready: ", roomid)
            }

        } catch (error) {
            socket.emit("error", "Server: failed to set up rtp transport")
            console.error(error)
        }
    }

    // ===========================
    socket.on("createProducerTransport", onCreateProducerTransport);
    socket.on("connectProducerTransport", onConnectProducerTransport);
    socket.on("produce", onProduce);

    //handle hostname change (here hostname means the person's name who streams)

    const onHostnameChange = (newName) => {
        console.log("Change hostname: ", newName)
        rooms[roomid]["hostname"] = newName;
        io.to(roomid).emit("hostname", newName)
    }

    socket.on("hostname", onHostnameChange)

    socket.once("leaveroom", () => {
        socket.off("createProducerTransport", onCreateProducerTransport);
        socket.off("connectProducerTransport", onConnectProducerTransport);
        socket.off("produce", onProduce);
        socket.off("hostname", onHostnameChange)
    })

    // ===========================

    socket.emit("viewcount", rooms[roomid]["viewers"]);


    // send rtp capabilities
    console.log("Sending router capabilities")
    socket.emit('routerRtpCapabilities', router.rtpCapabilities);

    socket.emit("roomname", rooms[roomid]["roomname"])
}

module.exports = { hostHandler }