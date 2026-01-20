import { Link, useNavigate } from 'react-router'
import './App.css'
import { useEffect, useState } from 'react'
import type { room } from './interfaces/room'
import createRandomString from './utils/createRandomString'
import socket from './Socket'
import Header from './components/Header'

function App() {

  const [rooms, setRooms] = useState<Array<room>>([])

  const [streamHistory, setStreamHistory] = useState<Record<string, room>>();

  const [streamId, setStreamId] = useState(createRandomString(10))

  const Navigate = useNavigate();

  useEffect(() => {

    const onRoomList = (roomlist: Array<room>) => {
      setRooms(roomlist);
    }

    socket.on("roomlist", onRoomList)

    const update = () => {
      socket.emit("roomlist")
    }

    let updateInterval = setInterval(update, 5000);
    update();

    // load streaming history

    const savedHistory = localStorage.getItem("streaminghistory");

    if (savedHistory != null) {
      try {
        setStreamHistory(JSON.parse(savedHistory))
      } catch (error) {
        console.error("failed to load stream history: ", error)
      }
    }


    return () => {
      clearInterval(updateInterval)
      socket.off("roomlist", onRoomList)
    };
  }, []);

  return (
    <div className='main'>
      <Header></Header>

      <div className='streams'>
        <h2>Available streams</h2>
        <div className='streamList'>
          {rooms.map(room => <div className='streamListItem' onClick={() => {
            Navigate("/view/" + room.id)
          }}>
            <h2>{room.roomname}</h2>
            <span>Viewers: {room.viewers}</span>
          </div>)}
        </div>
      </div>

      <div className='start-stream'>
        <h2>Start Stream</h2>

        <div className='input-group'>
          <label htmlFor="streamId">Stream Id</label>
          <input value={streamId} onChange={(ev) => { setStreamId(ev.target.value) }} name='streamId' id='streamId' type="text" placeholder='Stream id' />
        </div>

        <Link to={`/stream/${streamId}`}><button>Start stream</button></Link>
      </div>

      {streamHistory ? <div className='stream-history'>
        <h2>Streaming history</h2>
        <div className='streamList'>
          {Object.keys(streamHistory).map(room => <div className='streamListItem'>
            <h2>{streamHistory[room].roomname}</h2>
            <Link to={`/stream/${streamHistory[room].id}`}><button>Start stream</button></Link>
          </div>)}
        </div>
      </div> : ""}
    </div>
  )
}

export default App
