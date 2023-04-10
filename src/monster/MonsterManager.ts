import { Monster } from "./Monster";
import { GameScene } from "../GameScene";
import { Box } from "js-quadtree";
import Collision from "../utils/Collision";

export class MonsterManager {
  gameScene: GameScene;
  monsters: Set<Monster> = new Set();

  constructor(gameScene: GameScene) {
    this.gameScene = gameScene;
    setInterval(() => {
      this.run();
    }, 100);
  }

  registMonster(monster: Monster) {
    this.monsters.add(monster);
  }

  findMonsters(box: Box): Monster[] {
    const founds = [];
    for (const monster of this.monsters) {
      if (monster.isDied()) continue;
      const [x, y] = monster.position;
      const [w, h] = monster.size;
      if (Collision.rectToRect(box.x, box.y, box.w, box.h, x, y, w, h)) {
        founds.push(monster);
      }
    }
    return founds;
  }

  spawn() {
    for (const monster of this.monsters) {
      if (monster.canSpawn()) {
        monster.spawn();
      }
    }
  }

  send() {
    this.monsters.forEach((monster) => {
      if (monster.isDied()) return;

      this.gameScene.broadcast({ type: "MONSTER", payload: monster.getSyncData() });
    });
  }
  run() {
    this.spawn();
    this.send();
  }
}
