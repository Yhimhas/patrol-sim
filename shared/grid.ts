import type {
  CellType,
  Point,
  RobotDirection,
  RobotState,
} from './api.interface';

/**
 * 网格移动规则的唯一实现。
 * 前端乐观更新与后端状态推进都必须使用这里的函数，
 * 避免两边各写一套规则导致位置 / 电量不同步。
 */

export interface GridMap {
  width: number;
  height: number;
  grid: CellType[][];
}

export const CARDINAL_DIRECTIONS: readonly RobotDirection[] = [
  'up',
  'down',
  'left',
  'right',
];

export const DIRECTION_VECTORS: Record<RobotDirection, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function isInBounds(map: GridMap, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height;
}

export function isWalkable(map: GridMap, x: number, y: number): boolean {
  if (!isInBounds(map, x, y)) return false;
  return map.grid[y][x] !== 'obstacle';
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function computeNextPosition(
  position: Point,
  direction: RobotDirection,
): Point {
  const vector = DIRECTION_VECTORS[direction];
  return { x: position.x + vector.x, y: position.y + vector.y };
}

export type MoveBlockReason = 'battery' | 'out_of_bounds' | 'obstacle';

export const MOVE_BLOCK_MESSAGES: Record<MoveBlockReason, string> = {
  battery: '电量不足，请重置后再继续',
  out_of_bounds: '超出地图边界',
  obstacle: '前方是障碍物',
};

export interface MoveEvaluation {
  allowed: boolean;
  /** 目标位置；被阻挡时等于当前位置 */
  next: Point;
  reason?: MoveBlockReason;
}

/**
 * 判断机器人朝某个方向移动是否合法：
 * 电量耗尽 > 越界 > 障碍物。
 */
export function evaluateMove(
  map: GridMap,
  robot: Pick<RobotState, 'x' | 'y' | 'battery'>,
  direction: RobotDirection,
): MoveEvaluation {
  if (robot.battery <= 0) {
    return {
      allowed: false,
      next: { x: robot.x, y: robot.y },
      reason: 'battery',
    };
  }

  const next = computeNextPosition(robot, direction);

  if (!isInBounds(map, next.x, next.y)) {
    return { allowed: false, next, reason: 'out_of_bounds' };
  }

  if (map.grid[next.y][next.x] === 'obstacle') {
    return { allowed: false, next, reason: 'obstacle' };
  }

  return { allowed: true, next };
}

/** 仅当两个格子四邻相接时返回方向，否则返回 null */
export function directionBetween(from: Point, to: Point): RobotDirection | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === -1) return 'up';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 1 && dy === 0) return 'right';
  return null;
}

/**
 * 把从 startIndex 开始的相邻路径点转换为方向序列。
 * 路径存在不相邻的跳点时返回 null，调用方应要求重新规划。
 */
export function directionsForPath(
  path: Point[],
  startIndex: number,
): RobotDirection[] | null {
  if (startIndex < 0 || startIndex >= path.length) return null;

  const directions: RobotDirection[] = [];
  for (let i = startIndex; i < path.length - 1; i += 1) {
    const direction = directionBetween(path[i], path[i + 1]);
    if (!direction) return null;
    directions.push(direction);
  }
  return directions;
}
