export const ROBOT_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type RobotDirection = (typeof ROBOT_DIRECTIONS)[number];
export const isRobotDirection = (v: string): v is RobotDirection =>
  (ROBOT_DIRECTIONS as readonly string[]).includes(v);
export const ROBOT_DIRECTION_LABELS: Record<RobotDirection, string> = {
  up: '上',
  down: '下',
  left: '左',
  right: '右',
};

export const CELL_TYPES = ['empty', 'obstacle', 'start', 'target'] as const;
export type CellType = (typeof CELL_TYPES)[number];

export interface MapData {
  width: number;
  height: number;
  grid: CellType[][];
  start: { x: number; y: number };
  target: { x: number; y: number };
}

export interface RobotState {
  x: number;
  y: number;
  direction: RobotDirection;
  battery: number;
  steps: number;
  manhattanDistance: number;
}

export interface MoveRequest {
  direction: RobotDirection;
}

export interface MoveResponse {
  success: boolean;
  message: string;
  robot: RobotState;
}

/** 路径规划允许设置的最大检查点数量（前后端共用） */
export const MAX_CHECKPOINTS = 2;

export const PATH_ALGORITHMS = ['bfs', 'astar'] as const;
export type PathAlgorithm = (typeof PATH_ALGORITHMS)[number];
export const isPathAlgorithm = (v: string): v is PathAlgorithm =>
  (PATH_ALGORITHMS as readonly string[]).includes(v);
export const PATH_ALGORITHM_LABELS: Record<PathAlgorithm, string> = {
  bfs: 'BFS (广度优先)',
  astar: 'A* 算法',
};

export interface Point {
  x: number;
  y: number;
}

export interface PathPlanRequest {
  algorithm: PathAlgorithm;
  start: Point;
  end: Point;
  checkpoints?: Point[];
}

export interface PathPlanResponse {
  success: boolean;
  message: string;
  path: Point[];
  visitedOrder: Point[];
  pathLength: number;
  visitedCount: number;
}
