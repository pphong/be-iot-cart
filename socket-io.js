import { Server } from "socket.io";
import express from "express";
import http from "http";
const app = express();
const PORT = 8988;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// io.on("connection", (socket) => {
//   console.log("a user connected");
//   socket.on("disconnect", () => {
//     console.log("user disconnected");
//   });

//   const data = {
//     id: "123",
//     msg: "hello from nodejs"
//   }

//   setInterval(() => {
//     socket.send(data);
//   }, 2000)
// });

server.listen(PORT, () => {
  console.log("listening on *:8988");
});

export { io };
