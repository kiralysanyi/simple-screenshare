import { useNavigate } from 'react-router'
import './App.css'
import { useEffect, useState } from 'react'
import type { room } from './interfaces/room'
import socket from './Socket'
import Header from './components/Header'

function App() {

  const [rooms, setRooms] = useState<Array<room>>([])



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
            <span>Streamed by: <span>{room.hostname? room.hostname : "Unknown"}</span></span>
            <span>Viewers: {room.viewers}</span>
          </div>)}
        </div>
        <br />
        <button onClick={() => {Navigate("/selector")}}>Start stream</button>
      </div>


    </div>
  )
}

export default App
