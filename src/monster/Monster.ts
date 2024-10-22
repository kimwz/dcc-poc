import { Point, QuadTree } from "js-quadtree";
import { GameClient, PositionType } from "../GameClient";
import _ from "underscore";
import { GameScene } from "../GameScene";
import PF from "pathfinding";
import * as path from "path";
import { Grid } from "../utils/Grid";
import { FieldItem } from "../item/FieldItem";

export type MonsterOption = {
  maxHp?: number;
  speed?: number;
  watchGrid?: number;
  canSpawnPositions?: PositionType[];
  canMoveAreaFromSpawnPosition?: [PositionType, PositionType];
  spawnGap?: number;
  enableAutoMove?: boolean;
  items?: FieldItem[];
};
export class Monster {
  static nextId: number = 1;
  gameScene: GameScene;
  typeId;
  id;
  status: "IDLE" | "CHASE" | "COMBAT" | "DIED" = "DIED";
  diedTimestamp: number = 0;
  speed = 20;
  maxHp = 30;
  hp = 30;
  watchGrid = 50;

  localSubGrid: Array<Array<number>> = [[]];
  localOffsetGridX = 0;
  localOffsetGridY = 0;

  position: PositionType = [0, 0];
  size: number[] = [20, 20];
  canSpawnPositions: PositionType[] = [];
  spawnPosition?: PositionType;
  moveTargetPosition: PositionType[] = [[0, 0]];
  canMoveAreaFromSpawnPosition: [PositionType, PositionType] = [
    [-50, 0],
    [50, 0],
  ];
  spawnGap: number = 0;
  enableAutoMove = true;

  items?: FieldItem[];

  constructor(gameScene: GameScene, typeId: string, options: MonsterOption) {
    this.gameScene = gameScene;
    this.typeId = typeId;
    this.id = Monster.nextId++;

    this.canMoveAreaFromSpawnPosition =
      options.canMoveAreaFromSpawnPosition ?? this.canMoveAreaFromSpawnPosition;
    this.canSpawnPositions = options.canSpawnPositions ?? this.canSpawnPositions;
    this.spawnGap = options.spawnGap ?? this.spawnGap;
    this.enableAutoMove = options.enableAutoMove ?? this.enableAutoMove;
    this.watchGrid = options.watchGrid ?? this.watchGrid;
    this.items = options.items ?? this.items;
    this.maxHp = options.maxHp ?? this.maxHp;
    this.speed = options.speed ?? this.speed;

    setTimeout(() => {
      setInterval(() => {
        try {
          this.watchEnemy();
        } catch (e) {}
      }, 1000);
      setInterval(() => {
        if (this.enableAutoMove) {
          try {
            this.autoMove();
          } catch (e) {}
        }
      }, 100);
    }, _.random(0, 1000));
  }

  canSpawn() {
    return this.status === "DIED" && this.diedTimestamp + this.spawnGap < +new Date();
  }

  spawn() {
    this.spawnPosition = _.sample(this.canSpawnPositions);
    if (this.spawnPosition) {
      this.status = "IDLE";
      this.hp = this.maxHp;
      this.moveTargetPosition = [[...this.spawnPosition]];
      this.setPosition(this.spawnPosition);

      const { subgrid, offsetX, offsetY } = this.gameScene.extractSubGrid(
        this.spawnPosition[0],
        this.spawnPosition[1],
        this.watchGrid,
      );
      this.localSubGrid = subgrid;
      this.localOffsetGridX = offsetX;
      this.localOffsetGridY = offsetY;
    }
  }

  watchEnemy() {
    if (this.status !== "IDLE" && this.status !== "CHASE" && this.status !== "COMBAT") return;

    const clients = this.gameScene.getClients();
    const founds = clients.filter((c) => this.isInWatchArea(c.avatar?.position));
    if (founds.length > 0) {
      const { path, offsetX, offsetY } = this.findLocalPathToTarget(founds[0].avatar?.position);
      if (path && path.length > 1) {
        const moveTargetPosition: PositionType[] = [];
        for (let i = 1; i < path.length; i++) {
          const [pathGradX, pathGridY] = path[i];
          moveTargetPosition.push(Grid.toPosition(pathGradX + offsetX, pathGridY + offsetY));
        }

        this.moveTargetPosition = moveTargetPosition;
        this.status = "CHASE";
      } else if (path && path.length <= 2) {
        this.attack(founds[0]);
        this.status = "COMBAT";
      }
    } else {
      this.status = "IDLE";
    }
  }

  isInWatchArea(target: PositionType | undefined) {
    if (!target) return false;
    const { gridX, gridY } = Grid.from(target);
    if (gridX - this.localOffsetGridX < 0) return false;
    if (gridY - this.localOffsetGridY < 0) return false;
    if (gridX - this.localOffsetGridX >= this.localSubGrid[0].length) return false;
    if (gridY - this.localOffsetGridY >= this.localSubGrid.length) return false;
    return true;
  }
  findLocalPathToTarget(target?: PositionType) {
    if (!target || !this.isInWatchArea(target)) return {};

    const { gridX, gridY } = Grid.from(this.position);
    const { gridX: targetGridX, gridY: targetGridY } = Grid.from(target);
    const { subgrid, offsetX, offsetY } = this.gameScene.extractSubGrid(
      this.position[0],
      this.position[1],
      this.watchGrid,
    );
    const gridInstance = new PF.Grid(subgrid);
    const finder = new PF.AStarFinder({ diagonalMovement: 1 });

    const isLeftSide = gridX < targetGridX;
    const positions = [
      [isLeftSide ? -4 : 4, 0],
      [isLeftSide ? -3 : 3, -1],
      [isLeftSide ? -3 : 3, 1],
      [isLeftSide ? 4 : -4, 0],
      [isLeftSide ? 3 : -3, 1],
      [isLeftSide ? 3 : -3, -1],
    ];

    const found = positions.find((position) => {
      try {
        const to =
          subgrid[targetGridY - offsetY + position[1]][targetGridX - offsetX + position[0]];
        return to === 0 || to === this.id;
      } catch (e) {
        console.log(e);
      }
    });

    if (found) {
      const path = finder.findPath(
        gridX - offsetX,
        gridY - offsetY,
        targetGridX - offsetX + found[0],
        targetGridY - offsetY + found[1],
        gridInstance,
      );
      return { path, offsetX, offsetY };
    }

    return {};
  }

  setPosition(position: PositionType) {
    try {
      const { gridX: exGridX, gridY: exGridY } = Grid.from(this.position);
      let { gridX, gridY } = Grid.from(position);
      if (exGridX !== gridX || exGridY !== gridY) {
        if (this.gameScene.grid[exGridY][exGridX] === this.id) {
          this.gameScene.grid[exGridY][exGridX] = 0;
        }

        this.gameScene.grid[gridY][gridX] = this.id;
      }

      this.position = [...position];
    } catch (e) {
      console.error(e);
    }
  }
  autoMove() {
    if (this.status === "DIED" || !this.spawnPosition) return;
    if (
      this.moveTargetPosition.length > 0 &&
      this.position[0] === this.moveTargetPosition[0][0] &&
      this.position[1] === this.moveTargetPosition[0][1]
    ) {
      this.moveTargetPosition.shift();
    }
    if (this.status === "IDLE" && this.moveTargetPosition.length === 0) {
      let [[minX, minY], [maxX, maxY]] = this.canMoveAreaFromSpawnPosition;

      minX += this.spawnPosition[0];
      minY += this.spawnPosition[1];
      maxX += this.spawnPosition[0];
      maxY += this.spawnPosition[1];

      if (this.position[0] === minX && this.position[1] === minY) {
        this.moveTargetPosition = [[maxX, maxY]];
      } else {
        this.moveTargetPosition = [[minX, minY]];
      }
    }

    if (this.moveTargetPosition.length === 0) return;

    const targetPosition = this.moveTargetPosition[0];

    let deltaX = targetPosition[0] - this.position[0];
    let deltaY = targetPosition[1] - this.position[1];

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    let speed = deltaX != 0 && deltaY != 0 ? this.speed / 1.414 : this.speed;
    if (deltaX < 0) deltaX = Math.max(-speed, deltaX);
    else if (deltaX > 0) deltaX = Math.min(speed, deltaX);
    if (deltaY < 0) deltaY = Math.max(-speed, deltaY);
    else if (deltaY > 0) deltaY = Math.min(speed, deltaY);

    this.setPosition([this.position[0] + deltaX, this.position[1] + deltaY]);
  }

  isDied() {
    return this.status === "DIED";
  }

  attack(client: GameClient) {
    const direction = this.position[0] < client.avatar!.position[0] ? 1 : -1;
    this.gameScene.broadcast({
      type: "MONSTER",
      payload: { ...this.getSyncData(), animation: "Attack", direction },
    });
    client.sendPacket({
      clientId: client.clientId,
      type: "ACTION",
      payload: { animation: "Hit" },
    });
  }
  hit(damage: number) {
    this.hp -= damage;
    if (this.hp <= 0) {
      this.die();
    }

    if (this.isDied()) {
      this.gameScene.broadcast({
        type: "MONSTER",
        payload: { ...this.getSyncData(), animation: "Die", damage, hpPercent: 0 },
      });
    } else {
      this.gameScene.broadcast({
        type: "MONSTER",
        payload: {
          ...this.getSyncData(),
          animation: "Hit",
          damage,
          hpPercent: this.hp / this.maxHp,
        },
      });
    }
  }

  die() {
    this.status = "DIED";
    this.diedTimestamp = +new Date();

    if (this.items && this.items.length > 0) {
      for (const item of this.items) {
        const dropItem = item.dropOnField([
          this.position[0] + _.random(-30, 30),
          this.position[1] + _.random(-30, 30),
        ]);
        if (dropItem) {
          this.gameScene.broadcast({
            type: "FIELD_ITEM",
            payload: dropItem.getSyncData(),
          });
        }
      }
    }
  }

  getSyncData() {
    return {
      id: this.id,
      typeId: this.typeId,
      hp: this.hp,
      position: this.position,
    };
  }
}
