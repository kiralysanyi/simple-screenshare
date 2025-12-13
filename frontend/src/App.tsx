import { Link, useNavigate } from 'react-router'
import './App.css'
import { useEffect, useState } from 'react'
import type { room } from './interfaces/room'
import createRandomString from './utils/createRandomString'
import socket from './Socket'

function App() {

  const [rooms, setRooms] = useState<Array<room>>([])
  const Navigate = useNavigate();

  useEffect(() => {

    socket.on("roomlist", (roomlist: Array<room>) => {
      setRooms(roomlist);
    })

    const update = () => {
      socket.emit("roomlist")
    }

    let updateInterval = setInterval(update, 5000);
    update();


    return () => {
      clearInterval(updateInterval)
    };
  }, []);

  return (
    <>
      <h1>Simple Screenshare</h1>
      <Link to={`/stream/${createRandomString(10)}`}><button>Start stream</button></Link>
      <h2>Available streams</h2>
      <div className='streamList'>
        {rooms.map(room => <div className='streamListItem' onClick={() => {
          Navigate("/view/" + room.id)
        }}>
          <h2>{room.roomname}</h2>
          <span>Viewers: {room.viewers}</span>
        </div>)}
      </div>
    </>
  )
}

export default App
