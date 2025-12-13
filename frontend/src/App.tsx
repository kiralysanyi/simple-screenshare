import { Link } from 'react-router'
import './App.css'
import { useEffect, useState } from 'react'
import getBaseUrl from './utils/getBaseUrl'
import type { room } from './interfaces/room'
import createRandomString from './utils/createRandomString'
import socket from './Socket'

const baseUrl = getBaseUrl();

function App() {

  const [rooms, setRooms] = useState<Array<room>>([])

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
      <h1>Simple screenshare</h1>
      <Link to={`/stream/${createRandomString(10)}`}><button>Start stream</button></Link>
      <h2>Available streams</h2>
      <div className='streamList'>
        {rooms.map(room => <div>
          <h1>{room.roomname}</h1>
        </div>)}
      </div>
    </>
  )
}

export default App
