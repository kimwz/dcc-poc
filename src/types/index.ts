export interface VerseData {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  playUrl: string;
  category: string;
  width: number;
  height: number;
  mod: { originalDataUrl: string; data: GameModData };
}

export interface GameModData {
  title: string;
  thumbnail: string;
  version: string;
  entryScene: string;
  scenes: GameModSceneData[];
}

export interface GameModSceneData {
  id: string;
  mapImage: string;
  collisionImage: string;
  width: number;
  height: number;
  startPositions: [number, number][];
  portals: { x: number; y: number; w: number; h: number; sceneName: string }[];
  monsters: GameModMonsterData[];
}

export interface GameModMonsterData {
  monsterId: string;
  name: string;
  spawnPositions: [number, number][];
  hp: number;
  speed: number;
  dropItems: { itemId: string; chance: number }[];
}
