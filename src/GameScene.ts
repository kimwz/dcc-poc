import { GameServer, SceneName } from "./GameServer";
import { GameClient, PositionType } from "./GameClient";
import { Box, QuadTree } from "js-quadtree";
import WebSocket from "ws";
import { MonsterManager } from "./monster/MonsterManager";
import { MonsterDonguri } from "./monster/MonsterDonguri";
import { Monster } from "./monster/Monster";
import _ from "underscore";
import { SendPacket } from "./Packet";
import Collision from "./utils/Collision";
import { Grid } from "./utils/Grid";
import { FieldItem } from "./item/FieldItem";
import { utils } from "ethers";
import { GameModMonsterData, GameModSceneData } from "./types";
import { intToRGBA, Jimp } from "jimp";

export type ScenePortalType = {
  x: number;
  y: number;
  w: number;
  h: number;
  sceneName: SceneName;
};
export class GameScene {
  gameServer: GameServer;
  name: SceneName;
  sceneData: GameModSceneData;
  width: number;
  height: number;
  grid: Array<Array<number>> = [[]];
  startPositions: PositionType[];

  monsterManager: MonsterManager;
  clientIds = new Set<string>();
  scenePortals: ScenePortalType[];

  fieldItems: FieldItem[] = [];

  constructor(
    gameServer: GameServer,
    name: SceneName,
    grid: Array<Array<number>>,
    sceneData: GameModSceneData,
  ) {
    this.gameServer = gameServer;
    this.name = name;
    this.sceneData = sceneData;
    this.width = sceneData.width;
    this.height = sceneData.height;
    this.startPositions = sceneData.startPositions;
    this.scenePortals = sceneData.portals;
    this.grid = grid;
    this.monsterManager = new MonsterManager(this);
    this.initMonsterManager(sceneData.monsters);
  }

  initMonsterManager(monsters: GameModMonsterData[]) {
    for (const monster of monsters) {
      this.monsterManager.registMonster(
        new Monster(this, monster.monsterId, {
          maxHp: monster.hp,
          speed: monster.speed,
          canSpawnPositions: monster.spawnPositions,
          canMoveAreaFromSpawnPosition: [
            [-100, 0],
            [100, 0],
          ],
          spawnGap: _.random(3000, 5000),
          items: monster.dropItems.map((item) => new FieldItem(this, item.itemId, item.chance)),
        }),
      );
    }

    if (monsters.length <= 1) {
      const token = new FieldItem(this, "306043", 1);
      for (let i = 0; i < 10; i++) {
        const items = [token, new FieldItem(this, "306049", 0.5)];
        this.monsterManager.registMonster(
          new Monster(
            this,
            _.sample(["201000", "201001", "201002", "201004", "201008"]) || "201000",
            {
              canSpawnPositions: [[_.random(1797, 3902), _.random(851, 2088)]],
              canMoveAreaFromSpawnPosition: [
                [-100, 0],
                [100, 0],
              ],
              spawnGap: _.random(3000, 5000),
              items,
            },
          ),
        );
      }

      this.monsterManager.registMonster(
        new Monster(this, "203003", {
          maxHp: 10000,
          speed: 40,
          canSpawnPositions: [[_.random(1797, 3902), _.random(851, 2088)]],
          canMoveAreaFromSpawnPosition: [
            [-300, 0],
            [300, 0],
          ],
          spawnGap: _.random(3000, 5000),
          items: [
            token,
            new FieldItem(this, "100000", 1),
            new FieldItem(this, "301000", 0.7),
            new FieldItem(this, "303404", 0.7),
            new FieldItem(this, "500000", 0.7),
          ],
        }),
      );

      this.monsterManager.registMonster(
        new Monster(this, "204012", {
          maxHp: 100,
          speed: 40,
          canSpawnPositions: [[_.random(1797, 3902), _.random(851, 2088)]],
          canMoveAreaFromSpawnPosition: [
            [-300, 0],
            [300, 0],
          ],
          spawnGap: _.random(3000, 5000),
          items: [new FieldItem(this, "10153000", 1)],
        }),
      );
      this.monsterManager.registMonster(
        new Monster(this, "204012", {
          maxHp: 100,
          speed: 40,
          canSpawnPositions: [[_.random(1797, 3902), _.random(851, 2088)]],
          canMoveAreaFromSpawnPosition: [
            [-300, 0],
            [300, 0],
          ],
          spawnGap: _.random(3000, 5000),
          items: [new FieldItem(this, "10153000", 1)],
        }),
      );
      this.monsterManager.registMonster(
        new Monster(this, "204012", {
          maxHp: 100,
          speed: 40,
          canSpawnPositions: [[_.random(1797, 3902), _.random(851, 2088)]],
          canMoveAreaFromSpawnPosition: [
            [-300, 0],
            [300, 0],
          ],
          spawnGap: _.random(3000, 5000),
          items: [new FieldItem(this, "10153000", 1)],
        }),
      );
    }
  }

  static async createGrid(width: number, height: number, collisionImage: string) {
    const { gridX: gridWidth, gridY: gridHeight } = Grid.from([width + 20, height + 20]);

    const createGridArray = async (gridRows: number, gridColumns: number, gridSize: number) => {
      const grid = new Array(gridRows);

      const img = await Jimp.read(collisionImage);

      for (let i = 0; i < gridRows; i++) {
        grid[i] = new Array(gridColumns);

        for (let j = 0; j < gridColumns; j++) {
          const x = j * gridSize;
          const y = i * gridSize;

          const imgX = Math.floor((x / width) * img.bitmap.width);
          const imgY = Math.floor((y / height) * img.bitmap.height);
          const pixel = img.getPixelColor(imgX, imgY);
          const rgba = intToRGBA(pixel);

          if (rgba.r === 255 && rgba.g === 255 && rgba.b === 255) {
            grid[i][j] = 0; // white
          } else {
            grid[i][j] = 1; // non-white
          }
        }
      }

      return grid;
    };

    return await createGridArray(gridHeight, gridWidth, Grid.size);
  }

  extractSubGrid(centerX: number, centerY: number, size: number) {
    const { gridX, gridY } = Grid.from([centerX, centerY]);
    const startX = Math.max(gridX - Math.floor(size / 2), 0);
    const startY = Math.max(gridY - Math.floor(size / 2), 0);
    const endX = Math.min(gridX + Math.floor(size / 2), this.grid[0].length - 1);
    const endY = Math.min(gridY + Math.floor(size / 2), this.grid.length - 1);

    const subgrid = [];

    for (let y = startY; y <= endY; y++) {
      const row = [];
      for (let x = startX; x <= endX; x++) {
        row.push(this.grid[y][x]);
      }
      subgrid.push(row);
    }
    return {
      subgrid,
      offsetX: startX,
      offsetY: startY,
    };
  }

  getClients(): GameClient[] {
    return this.gameServer.getClients(this.name);
  }
  addClientId(clientId: string) {
    this.clientIds.add(clientId);
  }

  deleteClientId(clientId: string) {
    this.clientIds.delete(clientId);
  }

  broadcast(packet: SendPacket, except?: WebSocket) {
    this.gameServer.getClients(this.name).forEach(({ socket }) => {
      if (except !== socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(packet));
      }
    });
  }

  findFieldItems(x1: number, y1: number, w1: number, h1: number) {
    for (const item of this.fieldItems) {
      if (item.onField) {
        const [x2, y2] = item.position;
        if (x1 < x2 + 100 && x1 + w1 > x2 && y1 < y2 + 100 && y1 + h1 > y2) {
          return item;
        }
      }
    }
  }

  pickUpItem(client: GameClient, item: FieldItem) {
    if (item.onField) {
      item.onField = false;

      client.addItem(item.toItem());

      if (Number(item.typeId) > 10000000) {
        client.avatar!.weapon = item.typeId;
        this.broadcast({
          type: "AVATAR",
          clientId: client.clientId,
          payload: { avatar: client.avatar },
        });
      } else if (item.typeId === "306043") {
        this.gameServer.mintToken(
          client.bondingCurveToken,
          client.verseAddress,
          client.address!,
          utils.parseEther(_.random(1, 10).toString()).toString(),
        );
      } else {
        this.gameServer.mintItem(client.address!, item.typeId);
      }

      this.broadcast({
        type: "PICK_FIELD_ITEM",
        clientId: client.clientId,
        payload: { id: item.id },
      });
    }
  }

  collideScenePortal(x1: number, y1: number, w1: number, h1: number) {
    for (const portal of this.scenePortals) {
      const { x: x2, y: y2, w: w2, h: h2, sceneName } = portal;
      if (x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2) {
        return sceneName;
      }
    }
  }

  attackArea(attacker: GameClient, box: Box, attackType?: string) {
    const founds = this.monsterManager.findMonsters(box);

    if (founds) {
      founds.forEach((monster: Monster) => {
        const damage = attackType === "CriticalAttack" ? _.random(15, 30) : _.random(1, 10);

        let multiplier = 1;

        if (attacker.avatar?.weapon === "10121000") {
          multiplier = 3;
        } else if (attacker.avatar?.weapon === "10131001") {
          multiplier = 10;
        } else if (attacker.avatar?.weapon === "10153000") {
          multiplier = 20;
        }
        monster.hit(damage * multiplier);
      });
    }
  }
}

export class AdminScene extends GameScene {
  initMonsterManager() {
    const typeIds = [
      "201000",
      "201004",
      "201008",
      "202003",
      "202007",
      "203003",
      "203007",
      "204003",
      "204012",
      "204021",
      "205000",
      "205004",
      "206000",
      "206004",
      "207000",
      "207004",
      // "900001",
      // "201001",
      // "201005",
      // "202000",
      // "202004",
      // "203000",
      // "203004",
      // "204000",
      // "204004",
      // "204013",
      // "204022",
      // "205001",
      // "205005",
      // "206001",
      // "206005",
      // "207001",
      // "207005",
      // "201002",
      // "201006",
      // "202001",
      // "202005",
      // "203001",
      // "203005",
      // "204001",
      // "204010",
      // "204014",
      // "204023",
      // "205002",
      // "205006",
      // "206002",
      // "206006",
      // "207002",
      // "207006",
      // "201003",
      // "201007",
      // "202002",
      // "202006",
      // "203002",
      // "203006",
      // "204002",
      // "204011",
      // "204020",
      // "204024",
      // "205003",
      // "205007",
      // "206003",
      // "206007",
      // "207003",
      // "207007",
    ];

    let i = 0;
    for (let typeId of typeIds) {
      i++;
      this.monsterManager.registMonster(
        new Monster(this, typeId, {
          canSpawnPositions: [[_.random(1797, 3902), _.random(851, 2088)]],
          canMoveAreaFromSpawnPosition: [
            [-20, 0],
            [20, 0],
          ],
          spawnGap: 4000,
        }),
      );
    }
  }
}
