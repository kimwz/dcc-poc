import WebSocket from "ws";
import { GameServer, server } from "./GameServer";

const gameServer = new GameServer();

server.on("connection", (socket: WebSocket) => {
  let clientId: string;

  socket.on("message", (message: string) => {
    const data = JSON.parse(message);
    if (data.type === "JOIN") {
      clientId = data.clientId;
    }

    try {
      gameServer.packetReceiver(data, socket);
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("close", () => {
    try {
      gameServer.disconnect(clientId);
    } catch (e) {
      console.log(e);
    }
  });
});
