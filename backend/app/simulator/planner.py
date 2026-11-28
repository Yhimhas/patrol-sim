"""栅格 A* 路径规划：在可通行格之间寻找绕开障碍物的最短路径。"""

import heapq

from .world import DIRECTIONS, Position, World


def _heuristic(a: Position, b: Position) -> int:
    # 四邻域移动下，曼哈顿距离是可采纳的启发式估计。
    return abs(a.x - b.x) + abs(a.y - b.y)


def plan(world: World, start: Position, goal: Position) -> list[Position] | None:
    """返回从 start 到 goal 的格点路径（含起点和终点）；不可达时返回 None。

    起点或终点本身不可通行时同样视为不可达。
    """
    if not world.passable(start) or not world.passable(goal):
        return None

    if start == goal:
        return [start]

    open_set: list[tuple[int, int, Position]] = []
    counter = 0
    heapq.heappush(open_set, (_heuristic(start, goal), counter, start))

    came_from: dict[Position, Position] = {}
    g_score: dict[Position, int] = {start: 0}

    while open_set:
        _, _, current = heapq.heappop(open_set)
        if current == goal:
            return _reconstruct(came_from, current)

        for dx, dy in DIRECTIONS.values():
            neighbor = Position(current.x + dx, current.y + dy)
            if not world.passable(neighbor):
                continue
            tentative = g_score[current] + 1
            if tentative < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative
                counter += 1
                heapq.heappush(
                    open_set,
                    (tentative + _heuristic(neighbor, goal), counter, neighbor),
                )

    return None


def _reconstruct(came_from: dict[Position, Position], current: Position) -> list[Position]:
    path = [current]
    while current in came_from:
        current = came_from[current]
        path.append(current)
    path.reverse()
    return path
