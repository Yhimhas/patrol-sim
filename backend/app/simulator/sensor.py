"""虚拟传感器：沿机器人当前朝向扫描前方一格射线，模拟前向障碍检测。"""

from .world import DIRECTIONS, Position, World


def scan(world: World, robot_pos: Position, direction: str) -> dict:
    """返回前方感知结果。

    - ``blocked``：相邻一格是否被边界或障碍物挡住。
    - ``hit``：阻挡来源，``obstacle`` 为障碍物，``boundary`` 为地图边界，通畅时为 null。
    - ``distance``：沿朝向在碰到边界/障碍之前可通行的格数（不含当前格）。
    - ``ahead``：相邻一格坐标；出界时为 null。
    """
    dx, dy = DIRECTIONS[direction]
    distance = 0
    blocked = False
    hit: str | None = None
    ahead: Position | None = None

    current = robot_pos
    while True:
        nxt = Position(current.x + dx, current.y + dy)
        if not world.in_bounds(nxt):
            blocked = True
            hit = "boundary"
            break
        if world.is_obstacle(nxt):
            blocked = True
            hit = "obstacle"
            break
        distance += 1
        ahead = nxt
        current = nxt
        if distance >= max(world.width, world.height):
            break

    return {
        "direction": direction,
        "blocked": blocked,
        "hit": hit,
        "distance": distance,
        "ahead": ahead.as_dict() if ahead else None,
    }
