export type SendPacket = {
  type:
    | "JOIN"
    | "LOAD"
    | "LEAVE"
    | "NEW_CLIENT"
    | "AVATAR"
    | "AVATARS"
    | "MOVE"
    | "ACTION"
    | "CHAT"
    | "MONSTER"
    | "FIELD_ITEM"
    | "PICK_FIELD_ITEM";
  clientId?: string;
  payload?: any;
};

export type ReceivePacket = {
  type: "JOIN" | "LOAD" | "READY" | "MOVE" | "ACTION" | "CHAT";
  clientId: string;
  jwt?: string;
  payload?: any | LoadPayload | ActionPayload;
};

export type LoadPayload = {
  nickname: string;
  dccId: number;
  address: string;
};

export type ActionPayload = {
  position: [number, number];
  animation?: string;
  direction?: number;
};

export type ChatPayload = {
  message: string;
};
