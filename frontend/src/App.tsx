import { useNavigate } from 'react-router'
import './App.css'
import { useEffect, useState } from 'react'
import type { room } from './interfaces/room'
import socket from './Socket'
import Header from './components/Header'

function App() {

  const [rooms, setRooms] = useState<Array<room>>([])
  const navigate = useNavigate();

  useEffect(() => {
    const onRoomList = (roomlist: Array<room>) => {
      setRooms(roomlist);
    }

    socket.on("roomlist", onRoomList)

    socket.emit("roomlist")
    socket.emit("joinRoomlist")

    return () => {
      socket.off("roomlist", onRoomList)
      socket.emit("leaveall")
    };
  }, []);

  return (
    <div className='main'>
      <Header></Header>

      <div className='streams'>
        <h2>Available streams</h2>
        <div className='streamList'>
          {rooms.map(room => <div key={room.id} className='streamListItem' onClick={() => {
            navigate("/view/" + room.id)
          }}>
            <h2>{room.roomname}</h2>
            <span>Streamed by: <span>{room.hostname? room.hostname : "Unknown"}</span></span>
            <span>Viewers: {room.viewers}</span>
          </div>)}
        </div>
        <br />
        <button onClick={() => {navigate("/selector")}}>Start stream</button>
      </div>


    </div>
  )
}

export default App
