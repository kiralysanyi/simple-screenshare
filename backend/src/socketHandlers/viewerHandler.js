const { Socket } = require("socket.io");
const { cleanUp } = require("../utils/cleanup");
const { createWebRtcTransport } = require("../utils/mediasoup");

/**
 * 
 * @param {Socket} socket 
 * @param {import("mediasoup/types").Router} router
 * @param {Array} rooms
 */
const viewerHandler = (socket, router, rooms) => {
    const roomid = socket.roomid;
    socket.join(roomid);
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
        cleanUp(rooms, roomid);
    })

    socket.once("leaveroom", () => {
        if (rooms[roomid] == undefined) {
            return;
        }
        if (rooms[roomid]["viewers"] > 0) {
            rooms[roomid]["viewers"] -= 1
        }
        if (rooms[roomid]["hostsocket"]) {
            rooms[roomid]["hostsocket"].emit("viewcount", rooms[roomid]["viewers"]);
        }
        cleanUp(rooms, roomid);
    })

    // send rtp capabilities
    console.log("Sending router capabilities")
    socket.emit('routerRtpCapabilities', router.rtpCapabilities);

    // ===========================
    // Médialeves viewer cucca
    // ===========================

    const onCreateConsumerTransport = async (_, cb) => {
        console.log("createConsumerTransport")
        const { transport, params } = await createWebRtcTransport(router);
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
        if (transport == undefined) {
            console.error("Transport was undefined, can't set up transport for consumer.");
            socket.emit("error", "Server: failed to set up transport")
            return;
        }
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

    socket.emit("hostname", rooms[roomid]["hostname"])
    socket.emit("roomname", rooms[roomid]["roomname"])

    socket.emit("ready2view")
}

module.exports = { viewerHandler }