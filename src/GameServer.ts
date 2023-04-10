import WebSocket from "ws";
import { Box, QuadTree } from "js-quadtree";
import jwt from "jsonwebtoken";
import { DCCTraits } from "./constants/traits";
import { Avatar, GameClient } from "./GameClient";
import { AdminScene, GameScene } from "./GameScene";
import _ from "underscore";
import { ActionPayload, ChatPayload, LoadPayload, ReceivePacket, SendPacket } from "./Packet";
import { InfuraProvider } from "@ethersproject/providers";
import { Wallet, Contract, providers } from "ethers";
import { ABI } from "./constants/abi";
require("dotenv").config();
if (!process.env.JWT_SECRET) throw new Error("CAN NOT LOAD THE SECRET");

export const server = new WebSocket.Server({ port: 8080 });

export type SceneName = "MAIN" | "ADMIN" | "DUNGEON_1";

const Scenes: SceneName[] = ["MAIN", "DUNGEON_1"];

export class GameServer {
  clients = new Map<string, GameClient>();

  gameScenes = new Map<SceneName, GameScene>();
  constructor() {
    const provider = new InfuraProvider(5, "925d6202f06643a99a075ddd8e3d70af");

    this.gameScenes.set(
      "MAIN",
      new GameScene(
        this,
        "MAIN",
        2048 * 3,
        1304 * 3,
        [
          [3072, 2000],
          [3052, 1950],
        ],
        [{ x: 1624, y: 2372, w: 100, h: 100, sceneName: "ADMIN" }],
      ),
    );
    this.gameScenes.set(
      "ADMIN",
      new AdminScene(
        this,
        "ADMIN",
        2048 * 3,
        1304 * 3,
        [
          [3072, 2000],
          [3052, 1950],
        ],
        [{ x: 1624, y: 2372, w: 100, h: 100, sceneName: "MAIN" }],
      ),
    );
    console.log("SERVER STARTED!");
    this.initNonce();
  }

  nonce: number = 0;

  async initNonce() {
    const provider = new providers.JsonRpcProvider(process.env.RPC_URL!);
    const signer = new Wallet(process.env.SIGNER_PK!, provider);

    this.nonce = await signer.getTransactionCount();
    console.log("nonce", this.nonce);
  }

  private async _mint(name: string, args: any) {
    try {
      const provider = new providers.JsonRpcProvider(process.env.RPC_URL!);
      const signer = new Wallet(process.env.SIGNER_PK!, provider);
      const delegator = new Contract(
        process.env.ADDRESS_TOKEN_DELEGATOR!,
        ABI.TokenDelegator,
        signer,
      );

      const nonce = this.nonce;
      this.nonce += 1;
      await (
        await signer.sendTransaction({
          to: delegator.address,
          nonce,
          data: delegator.interface.encodeFunctionData(name, args),
        })
      ).wait();
    } catch (e) {
      console.log(e);
    }
  }
  async mintToken(address: string, amount: string) {
    await this._mint("mintERC20", [process.env.ADDRESS_ERC20, address, amount]);
    console.log("MINTED TOKEN", address, amount);
  }
  async mintItem(address: string, tokenId: string) {
    await this._mint("mintERC1155", [process.env.ADDRESS_ERC1155, address, [tokenId], [1]]);
    console.log("MINTED", address, tokenId);
  }

  getClients(scene: SceneName): GameClient[] {
    const ids = this.gameScenes.get(scene)!.clientIds;
    if (!ids) return [];

    return [...ids].map((clientId) => this.clients.get(clientId)).filter((v) => v) as GameClient[];
  }

  packetReceiver(data: ReceivePacket, socket: WebSocket) {
    if (data.type === "JOIN") {
      this.joinGame(data.clientId, socket);
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

  joinGame(clientId: string, socket: WebSocket) {
    if (this.clients.has(clientId)) {
      this.disconnect(clientId);
    }

    const client = new GameClient(clientId, socket);
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
      this.enterScene("MAIN", client);
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
