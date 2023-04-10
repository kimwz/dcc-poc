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
  width: number;
  height: number;
  grid: Array<Array<number>> = [[]];
  startPositions: PositionType[];

  monsterManager: MonsterManager;
  clientIds = new Set<string>();
  scenePortals: ScenePortalType[];

  fieldItems: FieldItem[] = [];

  obstacles = [
    { type: "line", data: [3576, 2323, 3553, 2402] },
    { type: "line", data: [3463, 2210, 3576, 2323] },
    { type: "line", data: [3447, 2111, 3463, 2210] },
    { type: "line", data: [3169, 2088, 3447, 2111] },
    { type: "line", data: [2801, 2148, 3169, 2088] },
    { type: "line", data: [2586, 2404, 2801, 2148] },
    { type: "square", data: [2991, 1476, 60, 72] },
    { type: "circle", data: [2968, 1602, 52] },
    { type: "line", data: [3655, 660, 3782, 663] },
    { type: "line", data: [2987, 319, 3655, 660] },
    { type: "line", data: [2849, 465, 2987, 319] },
    { type: "line", data: [2022, 615, 2849, 465] },
    { type: "line", data: [999, 1357, 2022, 615] },
    { type: "line", data: [890, 1609, 999, 1357] },
    { type: "line", data: [1008, 1682, 883, 1610] },
    { type: "line", data: [1106, 1569, 1008, 1682] },
    { type: "line", data: [1208, 1780, 1106, 1569] },
    { type: "line", data: [3559, 2359, 3598, 2511] },
    { type: "line", data: [2528, 2564, 2650, 2322] },
    { type: "circle", data: [3072, 1609, 49] },
    { type: "circle", data: [3021, 1610, 48] },
    { type: "line", data: [1160, 1782, 1635, 2059] },
    { type: "line", data: [1648, 2287, 1546, 2347] },
    { type: "line", data: [1648, 2056, 1657, 2281] },
    { type: "line", data: [1538, 2344, 1375, 2287] },
    { type: "line", data: [1375, 2295, 1678, 2541] },
    { type: "line", data: [1682, 2539, 1776, 2454] },
    { type: "line", data: [1774, 2446, 1823, 2377] },
    { type: "line", data: [1810, 2278, 1813, 2380] },
    { type: "line", data: [1821, 2254, 1900, 2197] },
    { type: "line", data: [1910, 2205, 2530, 2568] },
    { type: "line", data: [3795, 642, 4058, 751] },
    { type: "line", data: [4061, 737, 4191, 720] },
    { type: "line", data: [4192, 731, 4231, 933] },
    { type: "line", data: [4246, 931, 4636, 1103] },
    { type: "line", data: [4651, 1105, 4852, 1077] },
    { type: "line", data: [4860, 1087, 5027, 1155] },
    { type: "line", data: [5033, 1163, 5181, 1393] },
    { type: "line", data: [5193, 1405, 5265, 1504] },
    { type: "line", data: [5264, 1524, 4784, 1793] },
    { type: "line", data: [4760, 1786, 4619, 1609] },
    { type: "line", data: [4590, 1596, 4435, 1735] },
    { type: "line", data: [4432, 1745, 4450, 1952] },
    { type: "line", data: [4446, 1957, 4245, 2052] },
    { type: "line", data: [4240, 2042, 4089, 1881] },
    { type: "line", data: [4076, 1890, 3938, 2033] },
    { type: "line", data: [3935, 2040, 3973, 2292] },
    { type: "line", data: [3959, 2298, 3801, 2383] },
    { type: "line", data: [3791, 2368, 3711, 2195] },
    { type: "line", data: [3697, 2199, 3583, 2393] },
  ];
  constructor(
    gameServer: GameServer,
    name: SceneName,
    width: number,
    height: number,
    startPositions: PositionType[],
    scenePortals: ScenePortalType[] = [],
  ) {
    this.gameServer = gameServer;
    this.name = name;
    this.width = width;
    this.height = height;
    this.startPositions = startPositions;
    this.scenePortals = scenePortals;
    this.createGrid();
    this.monsterManager = new MonsterManager(this);

    this.initMonsterManager();
  }

  initMonsterManager() {
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

  createGrid() {
    const { gridX: gridWidth, gridY: gridHeight } = Grid.from([this.width, this.height]);
    const createGridArray = (gridRows: number, gridColumns: number, gridSize: number) => {
      const grid = new Array(gridRows);

      for (let i = 0; i < gridRows; i++) {
        grid[i] = new Array(gridColumns);

        for (let j = 0; j < gridColumns; j++) {
          const x = j * gridSize;
          const y = i * gridSize;

          if (this.obstacles.some((wall) => Collision.check(x, y, gridSize, gridSize, wall))) {
            grid[i][j] = 1;
          } else {
            grid[i][j] = 0;
          }
        }
      }

      return grid;
    };

    this.grid = createGridArray(gridHeight, gridWidth, Grid.size);
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
