import { Monster, MonsterOption } from "./Monster";
import { QuadTree } from "js-quadtree";
import { GameScene } from "../GameScene";

export class MonsterDonguri extends Monster {
  constructor(gameScene: GameScene, qtree: QuadTree, options: MonsterOption) {
    super(gameScene, "201000", qtree, options);
    this.maxHp = 10;
  }
}
