import WebSocket from "ws";
import { SceneName } from "./GameServer";
import { SendPacket } from "./Packet";
import { Item } from "./item/Item";
import { VerseData } from "./types";

export type TraitsType = number[];
export type PositionType = [number, number];
export class Avatar {
  name: string;
  traits: TraitsType;
  position: PositionType;
  weapon?: string;

  constructor(name: string, traits: TraitsType, position: PositionType) {
    this.name = name;
    this.traits = traits;
    this.position = position;
  }
}
export class GameClient {
  jwt?: string;
  clientId: string;
  address?: string;
  socket: WebSocket;
  verseData: VerseData;
  verseAddress: string;
  bondingCurveToken: string;
  scene: SceneName = "";

  items: Item[] = [];
  avatar?: Avatar;

  constructor(
    clientId: string,
    verseAddress: string,
    bondingCurveToken: string,
    verseData: VerseData,
    socket: WebSocket,
  ) {
    this.clientId = clientId;
    this.verseData = verseData;
    this.verseAddress = verseAddress;
    this.bondingCurveToken = bondingCurveToken;
    this.socket = socket;
  }

  sendPacket(packet: SendPacket) {
    this.socket.send(JSON.stringify(packet));
  }

  addItem(item: Item) {
    this.items.push(item);
  }
}
