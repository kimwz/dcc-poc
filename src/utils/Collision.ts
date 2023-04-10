export default class Collision {
  static check(x: number, y: number, w: number, h: number, obstacle: any) {
    if (obstacle.type === "square") {
      return this.rectToRect(
        x,
        y,
        w,
        h,
        obstacle.data[0],
        obstacle.data[1],
        obstacle.data[2],
        obstacle.data[3],
      );
    } else if (obstacle.type === "line") {
      return this.rectToLine(
        x,
        y,
        w,
        h,
        obstacle.data[0],
        obstacle.data[1],
        obstacle.data[2],
        obstacle.data[3],
      );
    } else if (obstacle.type === "circle") {
      return this.rectToCircle(x, y, w, h, obstacle.data[0], obstacle.data[1], obstacle.data[2]);
    }
    return false;
  }
  static rectToRect(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number,
  ) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }
  static rectToTriangle(
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number,
    triX1: number,
    triY1: number,
    triX2: number,
    triY2: number,
    triX3: number,
    triY3: number,
  ) {
    function pointInTriangle(px: number, py: number) {
      function sign(p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number) {
        return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
      }

      const b1 = sign(px, py, triX1, triY1, triX2, triY2) < 0;
      const b2 = sign(px, py, triX2, triY2, triX3, triY3) < 0;
      const b3 = sign(px, py, triX3, triY3, triX1, triY1) < 0;

      return b1 === b2 && b2 === b3;
    }

    function pointInRectangle(px: number, py: number) {
      return px >= rectX && px <= rectX + rectWidth && py >= rectY && py <= rectY + rectHeight;
    }

    const rectPoints = [
      { x: rectX, y: rectY },
      { x: rectX + rectWidth, y: rectY },
      { x: rectX + rectWidth, y: rectY + rectHeight },
      { x: rectX, y: rectY + rectHeight },
    ];

    const triPoints = [
      { x: triX1, y: triY1 },
      { x: triX2, y: triY2 },
      { x: triX3, y: triY3 },
    ];

    // Check if any rectangle points are inside the triangle
    for (const point of rectPoints) {
      if (pointInTriangle(point.x, point.y)) {
        return true;
      }
    }

    // Check if any triangle points are inside the rectangle
    for (const point of triPoints) {
      if (pointInRectangle(point.x, point.y)) {
        return true;
      }
    }

    return false;
  }

  static rectToLine(
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number,
    lineX1: number,
    lineY1: number,
    lineX2: number,
    lineY2: number,
  ) {
    function lineIntersection(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      x4: number,
      y4: number,
    ) {
      const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

      if (denominator === 0) {
        return false;
      }

      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

      return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    const rectLines = [
      { x1: rectX, y1: rectY, x2: rectX + rectWidth, y2: rectY },
      { x1: rectX + rectWidth, y1: rectY, x2: rectX + rectWidth, y2: rectY + rectHeight },
      { x1: rectX + rectWidth, y1: rectY + rectHeight, x2: rectX, y2: rectY + rectHeight },
      { x1: rectX, y1: rectY + rectHeight, x2: rectX, y2: rectY },
    ];

    for (const rectLine of rectLines) {
      if (
        lineIntersection(
          lineX1,
          lineY1,
          lineX2,
          lineY2,
          rectLine.x1,
          rectLine.y1,
          rectLine.x2,
          rectLine.y2,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  static clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }
  static rectToCircle(
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number,
    circleX: number,
    circleY: number,
    circleRadius: number,
  ) {
    // 원의 중심에서 가장 가까운 사각형의 점을 찾기
    const closestX = this.clamp(circleX, rectX, rectX + rectWidth);
    const closestY = this.clamp(circleY, rectY, rectY + rectHeight);

    // 원의 중심과 가장 가까운 점 사이의 거리를 계산
    const dx = circleX - closestX;
    const dy = circleY - closestY;
    const distanceSquared = dx * dx + dy * dy;

    // 거리가 원의 반지름보다 작거나 같으면 충돌이 발생
    return distanceSquared <= circleRadius * circleRadius;
  }
}
