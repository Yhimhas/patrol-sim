import { Injectable } from '@nestjs/common';
import { RobotService } from '../robot/robot.service';
import { MAX_CHECKPOINTS } from '@shared/api.interface';
import type {
  PathAlgorithm,
  PathPlanResponse,
  Point,
} from '@shared/api.interface';
import {
  CARDINAL_DIRECTIONS,
  DIRECTION_VECTORS,
  isWalkable,
  manhattan,
  samePoint,
} from '@shared/grid';
import type { GridMap } from '@shared/grid';

interface SearchResult {
  path: Point[];
  visitedOrder: Point[];
}

interface OpenNode {
  x: number;
  y: number;
  /** f = g + h */
  f: number;
  g: number;
  h: number;
}

/**
 * A* 开放列表使用二叉最小堆，避免每轮对数组整体排序。
 * f 相同时优先选择 h 更小的节点，让搜索更贴近目标方向。
 */
class MinHeap {
  private readonly nodes: OpenNode[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: OpenNode): void {
    this.nodes.push(node);
    this.siftUp(this.nodes.length - 1);
  }

  pop(): OpenNode | undefined {
    if (this.nodes.length === 0) return undefined;
    const top = this.nodes[0];
    const last = this.nodes.pop() as OpenNode;
    if (this.nodes.length > 0) {
      this.nodes[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private less(a: OpenNode, b: OpenNode): boolean {
    return a.f < b.f || (a.f === b.f && a.h < b.h);
  }

  private siftUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (!this.less(this.nodes[current], this.nodes[parent])) break;
      [this.nodes[current], this.nodes[parent]] = [
        this.nodes[parent],
        this.nodes[current],
      ];
      current = parent;
    }
  }

  private siftDown(index: number): void {
    const length = this.nodes.length;
    let current = index;
    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;

      if (left < length && this.less(this.nodes[left], this.nodes[smallest])) {
        smallest = left;
      }
      if (
        right < length &&
        this.less(this.nodes[right], this.nodes[smallest])
      ) {
        smallest = right;
      }
      if (smallest === current) break;

      [this.nodes[current], this.nodes[smallest]] = [
        this.nodes[smallest],
        this.nodes[current],
      ];
      current = smallest;
    }
  }
}

@Injectable()
export class PathService {
  constructor(private readonly robotService: RobotService) {}

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  private buildPath(
    prev: Map<string, string | null>,
    endX: number,
    endY: number,
  ): Point[] {
    const path: Point[] = [];
    let current: string | null = this.key(endX, endY);
    while (current !== null && current !== undefined) {
      const [cx, cy] = current.split(',').map(Number);
      path.push({ x: cx, y: cy });
      current = prev.get(current) ?? null;
    }
    return path.reverse();
  }

  bfs(start: Point, end: Point, map: GridMap): SearchResult {
    const visitedOrder: Point[] = [];
    const prev = new Map<string, string | null>();
    const visited = new Set<string>();
    const queue: Point[] = [];

    const startKey = this.key(start.x, start.y);
    prev.set(startKey, null);
    visited.add(startKey);
    queue.push({ x: start.x, y: start.y });

    // 使用游标出队，避免 Array.shift() 的 O(n) 移动
    let head = 0;
    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      visitedOrder.push({ x: current.x, y: current.y });

      if (current.x === end.x && current.y === end.y) {
        return {
          path: this.buildPath(prev, end.x, end.y),
          visitedOrder,
        };
      }

      for (const direction of CARDINAL_DIRECTIONS) {
        const { x: dx, y: dy } = DIRECTION_VECTORS[direction];
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nKey = this.key(nx, ny);

        if (!isWalkable(map, nx, ny)) continue;
        if (visited.has(nKey)) continue;

        visited.add(nKey);
        prev.set(nKey, this.key(current.x, current.y));
        queue.push({ x: nx, y: ny });
      }
    }

    return { path: [], visitedOrder };
  }

  astar(start: Point, end: Point, map: GridMap): SearchResult {
    const visitedOrder: Point[] = [];
    const prev = new Map<string, string | null>();
    const gScore = new Map<string, number>();
    const closed = new Set<string>();

    const startKey = this.key(start.x, start.y);
    const open = new MinHeap();

    const startH = manhattan(start, end);
    prev.set(startKey, null);
    gScore.set(startKey, 0);
    open.push({
      x: start.x,
      y: start.y,
      f: startH,
      g: 0,
      h: startH,
    });

    while (open.size > 0) {
      const current = open.pop() as OpenNode;
      const cKey = this.key(current.x, current.y);

      if (closed.has(cKey)) continue;
      closed.add(cKey);
      visitedOrder.push({ x: current.x, y: current.y });

      if (current.x === end.x && current.y === end.y) {
        return {
          path: this.buildPath(prev, end.x, end.y),
          visitedOrder,
        };
      }

      for (const direction of CARDINAL_DIRECTIONS) {
        const { x: dx, y: dy } = DIRECTION_VECTORS[direction];
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nKey = this.key(nx, ny);

        if (!isWalkable(map, nx, ny)) continue;
        if (closed.has(nKey)) continue;

        const tentativeG = current.g + 1;
        const existingG = gScore.get(nKey);

        if (existingG !== undefined && tentativeG >= existingG) continue;

        const h = manhattan({ x: nx, y: ny }, end);
        gScore.set(nKey, tentativeG);
        prev.set(nKey, cKey);
        open.push({
          x: nx,
          y: ny,
          f: tentativeG + h,
          g: tentativeG,
          h,
        });
      }
    }

    return { path: [], visitedOrder };
  }

  private planSegment(
    algorithm: PathAlgorithm,
    start: Point,
    end: Point,
    map: GridMap,
  ): SearchResult {
    if (algorithm === 'bfs') {
      return this.bfs(start, end, map);
    }
    return this.astar(start, end, map);
  }

  private failure(
    message: string,
    visitedOrder: Point[] = [],
  ): PathPlanResponse {
    return {
      success: false,
      message,
      path: [],
      visitedOrder,
      pathLength: 0,
      visitedCount: visitedOrder.length,
    };
  }

  plan(dto: {
    algorithm: PathAlgorithm;
    start: Point;
    end: Point;
    checkpoints?: Point[];
  }): PathPlanResponse {
    const map = this.robotService.getMap();
    const { algorithm, start, end } = dto;
    const checkpoints = dto.checkpoints ?? [];

    if (!isWalkable(map, start.x, start.y)) {
      return this.failure('起点不可通行或超出地图范围');
    }
    if (!isWalkable(map, end.x, end.y)) {
      return this.failure('终点不可通行或超出地图范围');
    }
    if (checkpoints.length > MAX_CHECKPOINTS) {
      return this.failure(`检查点最多 ${MAX_CHECKPOINTS} 个`);
    }
    for (let i = 0; i < checkpoints.length; i += 1) {
      const checkpoint = checkpoints[i];
      if (!isWalkable(map, checkpoint.x, checkpoint.y)) {
        return this.failure(`第 ${i + 1} 个检查点不可通行或超出地图范围`);
      }
    }

    // 按 起点 → 检查点 → 终点 组织航点，并去掉相邻重复点
    const waypoints: Point[] = [{ x: start.x, y: start.y }];
    for (const checkpoint of checkpoints) {
      if (!samePoint(waypoints[waypoints.length - 1], checkpoint)) {
        waypoints.push({ x: checkpoint.x, y: checkpoint.y });
      }
    }
    if (!samePoint(waypoints[waypoints.length - 1], end)) {
      waypoints.push({ x: end.x, y: end.y });
    }

    if (waypoints.length === 1) {
      const singlePath = [{ x: start.x, y: start.y }];
      return {
        success: true,
        message: '规划成功',
        path: singlePath,
        visitedOrder: singlePath,
        pathLength: 0,
        visitedCount: 1,
      };
    }

    let fullPath: Point[] = [];
    const fullVisitedOrder: Point[] = [];
    const seenVisited = new Set<string>();

    const appendVisited = (points: Point[]): void => {
      for (const point of points) {
        const pointKey = this.key(point.x, point.y);
        if (seenVisited.has(pointKey)) continue;
        seenVisited.add(pointKey);
        fullVisitedOrder.push({ x: point.x, y: point.y });
      }
    };

    for (let i = 0; i < waypoints.length - 1; i += 1) {
      const segStart = waypoints[i];
      const segEnd = waypoints[i + 1];

      const result = this.planSegment(algorithm, segStart, segEnd, map);
      appendVisited(result.visitedOrder);

      if (result.path.length === 0) {
        return this.failure(
          `从 (${segStart.x}, ${segStart.y}) 到 (${segEnd.x}, ${segEnd.y}) 无法找到路径`,
          fullVisitedOrder,
        );
      }

      if (fullPath.length === 0) {
        fullPath = result.path;
      } else {
        // 相邻路段共享连接点，拼接时去重
        fullPath = [...fullPath, ...result.path.slice(1)];
      }
    }

    return {
      success: true,
      message: '规划成功',
      path: fullPath,
      visitedOrder: fullVisitedOrder,
      pathLength: fullPath.length - 1,
      visitedCount: fullVisitedOrder.length,
    };
  }
}
