import { useEffect, useState } from "react";
import Header from "./components/Header";
import createRandomString from "./utils/createRandomString";
import type { room } from "./interfaces/room";
import { Link, useNavigate } from "react-router";

const StreamSelector = () => {
    const [streamHistory, setStreamHistory] = useState<Record<string, room>>();

    const [streamId, setStreamId] = useState(createRandomString(10))

    const Navigate = useNavigate();

    useEffect(() => {
        // load streaming history

        const savedHistory = localStorage.getItem("streaminghistory");

        if (savedHistory != null) {
            try {
                setStreamHistory(JSON.parse(savedHistory))
            } catch (error) {
                console.error("failed to load stream history: ", error)
            }
        }
    }, [])

    return <div className="main">
        <Header></Header>
        <div className='start-stream'>
            <h2>Start Stream</h2>

            <div className='input-group'>
                <label htmlFor="streamId">Stream Id</label>
                <input value={streamId} onChange={(ev) => { setStreamId(ev.target.value) }} name='streamId' id='streamId' type="text" placeholder='Stream id' />
            </div>

            <Link to={`/stream/${streamId}`}><button>Start new stream</button></Link>
        </div>

        {streamHistory ? <div className='stream-history'>
            <h2>Streaming history</h2>
            <div className='streamList'>
                {Object.keys(streamHistory).map(room => <div onClick={() => { Navigate(`/stream/${streamHistory[room].id}`) }} className='streamListItem'>
                    <h2>{streamHistory[room].roomname}</h2>
                    <span>ID: <b>{streamHistory[room].id}</b></span>
                    <span>Host's name: <b>{streamHistory[room].hostname}</b></span>
                </div>)}
            </div>
        </div> : ""}
    </div>
}

export default StreamSelector;