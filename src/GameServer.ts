import http from "http";
import WebSocket from "ws";
import { Box, QuadTree } from "js-quadtree";
import jwt from "jsonwebtoken";
import { DCCTraits } from "./constants/traits";
import { Avatar, GameClient } from "./GameClient";
import { AdminScene, GameScene } from "./GameScene";
import _ from "underscore";
import { ActionPayload, ChatPayload, LoadPayload, ReceivePacket, SendPacket } from "./Packet";
import fetch from "node-fetch";
import { VerseData } from "./types";
require("dotenv").config();
if (!process.env.JWT_SECRET) throw new Error("CAN NOT LOAD THE SECRET");

const httpServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
httpServer.listen(8080);

export const server = new WebSocket.Server({ server: httpServer });

export type SceneName = string;

const verseDataCache = Object();

export class GameServer {
  clients = new Map<string, GameClient>();

  gameScenes = new Map<SceneName, GameScene>();
  constructor() {
    console.log("SERVER STARTED!");
  }

  private async _mint(body: any) {
    try {
      const data = await fetch("https://api.g2platform.com/ops", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Access-Key": process.env.G2_ACCESS_KEY!,
          "Access-Secret": process.env.G2_ACCESS_SECRET!,
          "Content-Type": "application/json",
        },
      });
      const result = await data.json();
      if (result.error) {
        console.log(result);
      }
    } catch (e) {
      console.log(e);
    }
  }
  async mintToken(tokenAddress: string, verseAddress: string, address: string, amount: string) {
    await this._mint({
      verse: verseAddress,
      ops: [
        {
          type: "MINT_ERC20",
          token: tokenAddress,
          account: address,
          amount,
          toEOA: true,
        },
      ],
    });
    console.log("MINTED TOKEN", tokenAddress, address, amount);
  }
  async mintItem(address: string, tokenId: string) {
    // await this._mint([
    //   {
    //     type: "ERC1155",
    //     token: process.env.ADDRESS_ERC1155,
    //     to: address,
    //     id: tokenId,
    //     amount: "1",
    //   },
    // ]);
    console.log("MINTED", address, tokenId);
  }

  getClients(scene: SceneName): GameClient[] {
    const ids = this.gameScenes.get(scene)!.clientIds;
    if (!ids) return [];

    return [...ids].map((clientId) => this.clients.get(clientId)).filter((v) => v) as GameClient[];
  }

  packetReceiver(data: ReceivePacket, socket: WebSocket) {
    if (data.type === "JOIN") {
      this.joinGame(data.clientId, data.payload, socket);
    } else if (data.type === "LOAD" && data.jwt) {
      this.loadAvatarAndScene(data.clientId, data.jwt, data.payload);
    } else if (data.type === "READY" && data.jwt) {
      this.readyToStart(data.clientId, data.jwt);
    } else if (data.type === "MOVE" && data.jwt) {
      this.clientMove(data.clientId, data.jwt, data.payload);
    } else if (data.type === "ACTION" && data.jwt) {
      this.clientAction(data.clientId, data.jwt, data.payload);
    } else if (data.type === "CHAT" && data.jwt) {
      this.clientChat(data.clientId, data.jwt, data.payload);
    }
  }

  async joinGame(clientId: string, payload: any, socket: WebSocket) {
    if (this.clients.has(clientId)) {
      this.disconnect(clientId);
    }

    const verseAddress = payload.verse;
    const res = await fetch(`https://api.g2platform.com/verses/${verseAddress}`);
    const { verse } = await res.json();
    let verseData: VerseData = verseDataCache[verse.dataURI];

    if (!verseData) {
      verseData = (await (await fetch(verse.dataURI)).json()) as VerseData;
      verseDataCache[verse.dataURI] = verseData;
    }
    for (const scene of verseData.mod.data.scenes) {
      const sceneId = `${verseAddress}/${verseData.mod.data.version}/${scene.id}`;
      if (!this.gameScenes.has(sceneId)) {
        const grid = await GameScene.createGrid(scene.width, scene.height, scene.collisionImage);
        this.gameScenes.set(sceneId, new GameScene(this, sceneId, grid, scene));
      }
    }
    const bondingCurveToken = verse.bondingCurveToken[0];
    const client = new GameClient(clientId, verseAddress, bondingCurveToken, verseData, socket);
    client.jwt = jwt.sign(clientId, process.env.JWT_SECRET!);
    this.clients.set(clientId, client);
    this.sendPacket(clientId, { type: "JOIN", clientId, payload: { jwt: client.jwt } });
  }

  loadAvatarAndScene(clientId: string, jwt: string, payload: LoadPayload) {
    const client = this.clients.get(clientId);
    if (client?.jwt !== jwt) return;

    client.address = payload.address;
    if (payload.dccId >= 1 && payload.dccId <= 3000) {
      const traits = DCCTraits[payload.dccId];
      const avatar = new Avatar(payload.nickname, traits, [3072, 2000]);
      client.avatar = avatar;
      const sceneId = `${client.verseAddress}/${client.verseData.mod.data.version}/${client.verseData.mod.data.entryScene}`;
      this.enterScene(sceneId, client);
    }
  }

  readyToStart(clientId: string, jwt: string) {
    const client = this.clients.get(clientId);
    if (client?.jwt !== jwt) return;

    const avatars = this.getClients(client.scene).map((client) => ({
      clientId: client.clientId,
      avatar: client.avatar,
    }));
    this.sendPacket(clientId, { type: "AVATARS", payload: { scene: client.scene, avatars } });

    const scene = this.gameScenes.get(client.scene);
    if (scene) {
      for (const item of scene.fieldItems) {
        if (item.onField) {
          scene.broadcast({
            type: "FIELD_ITEM",
            payload: item.getSyncData(),
          });
        }
      }
    }

    console.log(this.getClients(client.scene).length);
  }

  clientMove(clientId: string, jwt: string, payload: ActionPayload) {
    const client = this.clients.get(clientId);
    if (client?.jwt !== jwt) return;

    client.avatar!.position = payload.position;

    //TODO: Validate move

    const scene = this.gameScenes.get(client.scene);
    if (scene) {
      const { x, y, w, h } = { x: payload.position[0], y: payload.position[1], w: 20, h: 20 };
      const item = scene.findFieldItems(x, y, w, h);
      if (item) {
        scene.pickUpItem(client, item);
      }
      const nextScene = scene.collideScenePortal(x, y, w, h);
      if (nextScene) {
        this.enterScene(nextScene, client);
      }
    }

    this.broadcast(
      client.scene,
      {
        type: "MOVE",
        clientId,
        payload,
      },
      client.socket,
    );
  }
  clientAction(clientId: string, jwt: string, payload: ActionPayload) {
    const client = this.clients.get(clientId);
    if (client?.jwt !== jwt) return;

    //TODO: Validate move
    client.avatar!.position = payload.position;

    this.broadcast(client.scene, { type: "ACTION", clientId, payload }, client.socket);

    if (payload.animation === "Attack" || payload.animation === "CriticalAttack") {
      setTimeout(() => {
        this.gameScenes
          .get(client.scene)!
          .attackArea(
            client,
            new Box(
              payload.position[0] + ((payload.direction || 0) > 0 ? 0 : -110),
              payload.position[1] - 90,
              110,
              110,
            ),
            payload.animation,
          );
      }, 350);
    }
  }

  clientChat(clientId: string, jwt: string, payload: ChatPayload) {
    const client = this.clients.get(clientId);
    if (client?.jwt !== jwt) return;

    this.broadcast(client.scene, { type: "CHAT", clientId, payload });
  }
  enterScene(scene: SceneName, client: GameClient) {
    if (client.scene) {
      this.leaveScene(client.scene, client.clientId);
    }
    console.log(`client ${client.clientId} : ${client.scene} -> ${scene}`);
    client.scene = scene;
    const position = _.sample(this.gameScenes.get(scene)!.startPositions);
    if (position) {
      client.avatar!.position = position;
    }
    this.sendPacket(client.clientId, {
      type: "LOAD",
      payload: { avatar: client.avatar, scene: client.scene },
    });
    this.gameScenes.get(scene)!.addClientId(client.clientId);
    this.broadcast(
      scene,
      {
        type: "NEW_CLIENT",
        clientId: client.clientId,
        payload: { avatar: client.avatar },
      },
      client.socket,
    );
  }

  leaveScene(scene: SceneName, clientId: string) {
    this.gameScenes.get(scene)!.deleteClientId(clientId);
    this.broadcast(scene, { type: "LEAVE", clientId });
  }

  sendPacket(clientId: string, packet: SendPacket) {
    const client = this.clients.get(clientId);
    if (client) {
      client.socket.send(JSON.stringify(packet));
    }
  }
  broadcast(scene: SceneName, packet: SendPacket, except?: WebSocket) {
    this.getClients(scene).forEach(({ socket }) => {
      if (except !== socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(packet));
      }
    });
  }
  disconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.leaveScene(client.scene, clientId);
    this.clients.delete(clientId);
  }
}
