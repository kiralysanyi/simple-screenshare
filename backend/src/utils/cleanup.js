const cleanUp = (rooms, roomid) => {
    if (rooms[roomid] == undefined) {
        return;
    }
    if (rooms[roomid]["hostsocket"] == undefined && rooms[roomid]["viewers"] < 1) {
        console.log("Removing empty room: ", roomid)
        delete rooms[roomid];
    }
}

module.exports = {cleanUp}