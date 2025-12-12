import { io } from "socket.io-client"
import getBaseUrl from "./utils/getBaseUrl"

let url: string | undefined = getBaseUrl();

if (url == "") {
  url = undefined;
}

const socket = io(url)

socket.on("connect", () => {
  console.log("Socket connected")
})

socket.on("error", (err) => {
  console.error(err);
})

export default socket;