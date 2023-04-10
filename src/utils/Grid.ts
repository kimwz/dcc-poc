import { PositionType } from "../GameClient";
import _ from "underscore";

export const Grid = {
  size: 20,
  from: (position: PositionType) => {
    return {
      gridX: Math.floor(position[0] / Grid.size),
      gridY: Math.floor(position[1] / Grid.size),
    };
  },
  toPosition: (gridX: number, gridY: number) => {
    return [
      Math.round(gridX * Grid.size) + _.random(0, Grid.size - 1),
      Math.round(gridY * Grid.size) + _.random(0, Grid.size - 1),
    ] as PositionType;
  },
};
