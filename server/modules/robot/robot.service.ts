import { Injectable } from '@nestjs/common';
import type {
  CellType,
  MapData,
  RobotDirection,
  RobotState,
  MoveResponse,
} from '@shared/api.interface';
import {
  evaluateMove,
  manhattan,
  MOVE_BLOCK_MESSAGES,
} from '@shared/grid';

@Injectable()
export class RobotService {
  private readonly width = 15;
  private readonly height = 10;
  private readonly start = { x: 1, y: 1 };
  private readonly target = { x: 13, y: 8 };
  private readonly grid: CellType[][];
  private robot: RobotState;

  constructor() {
    this.grid = this.buildGrid();
    this.robot = this.createInitialState();
  }

  private createInitialState(): RobotState {
    return {
      x: this.start.x,
      y: this.start.y,
      direction: 'right',
      battery: 100,
      steps: 0,
      manhattanDistance: manhattan(this.start, this.target),
    };
  }

  private buildGrid(): CellType[][] {
    const grid: CellType[][] = [];
    for (let y = 0; y < this.height; y += 1) {
      const row: CellType[] = [];
      for (let x = 0; x < this.width; x += 1) {
        row.push('empty');
      }
      grid.push(row);
    }

    const obstacles: Record<number, number[]> = {
      2: [3, 4, 5, 7, 8, 10, 11],
      4: [2, 5, 6, 7, 9, 12],
      6: [4, 5, 8, 9, 10, 12],
      8: [3, 6, 7, 10, 11],
    };

    for (const [yStr, xs] of Object.entries(obstacles)) {
      const y = Number(yStr);
      for (const x of xs) {
        grid[y][x] = 'obstacle';
      }
    }

    grid[this.start.y][this.start.x] = 'start';
    grid[this.target.y][this.target.x] = 'target';

    return grid;
  }

  getMap(): MapData {
    return {
      width: this.width,
      height: this.height,
      grid: this.grid.map((row: CellType[]): CellType[] => [...row]),
      start: { ...this.start },
      target: { ...this.target },
    };
  }

  getRobotState(): RobotState {
    return { ...this.robot };
  }

  reset(): RobotState {
    this.robot = this.createInitialState();
    return { ...this.robot };
  }

  move(direction: RobotDirection): MoveResponse {
    // 无论是否被阻挡，朝向都反映最后一次操作意图；位置/电量只在成功时变化。
    this.robot.direction = direction;

    const evaluation = evaluateMove(
      { width: this.width, height: this.height, grid: this.grid },
      this.robot,
      direction,
    );

    if (!evaluation.allowed) {
      const reason = evaluation.reason ?? 'obstacle';
      return {
        success: false,
        message: MOVE_BLOCK_MESSAGES[reason],
        robot: { ...this.robot },
      };
    }

    this.robot.x = evaluation.next.x;
    this.robot.y = evaluation.next.y;
    this.robot.battery = Math.max(0, this.robot.battery - 1);
    this.robot.steps += 1;
    this.robot.manhattanDistance = manhattan(this.robot, this.target);

    const arrived =
      this.robot.x === this.target.x && this.robot.y === this.target.y;

    return {
      success: true,
      message: arrived ? '已到达终点！' : '移动成功',
      robot: { ...this.robot },
    };
  }
}
