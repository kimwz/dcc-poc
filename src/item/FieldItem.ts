import { PositionType } from "../GameClient";
import { GameScene } from "../GameScene";
import { Item } from "./Item";

export class FieldItem {
  static nextId: number = 1;
  id;
  gameScene;
  typeId;
  onField: boolean = false;
  position: PositionType = [0, 0];
  dropProbability = 0;

  constructor(gameScene: GameScene, typeId: string, probability: number) {
    this.id = FieldItem.nextId++;
    this.gameScene = gameScene;
    this.typeId = typeId;
    this.dropProbability = probability;
  }

  dropOnField(position: PositionType): FieldItem | undefined {
    if (Math.random() < this.dropProbability && !this.onField) {
      const itemClone = new FieldItem(this.gameScene, this.typeId, this.dropProbability);
      itemClone.position = position;
      itemClone.onField = true;
      this.gameScene.fieldItems.push(itemClone);
      return itemClone;
    }
  }

  getSyncData() {
    return {
      id: this.id,
      typeId: this.typeId,
      position: this.position,
    };
  }

  toItem(): Item {
    return new Item(this.id, this.typeId);
  }
}
