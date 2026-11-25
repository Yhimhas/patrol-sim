"""仿真核心：机器人状态与运动规则（具身智能维护）。

坐标系：格子坐标，原点 (0,0) 在左上角，x 向右，y 向下。
朝向：0=上 90=右 180=下 270=左（顺时针）。
状态：idle / moving / patrolling / blocked。
"""

from pathplanning.grid_map import H, OBSTACLES, W

# 朝向 -> 单步位移
STEP = {0: (0, -1), 90: (1, 0), 180: (0, 1), 270: (-1, 0)}

ERROR_OUT_OF_BOUNDS = "OUT_OF_BOUNDS"
ERROR_OBSTACLE_BLOCKED = "OBSTACLE_BLOCKED"


class Robot:
    """机器人本体：只负责接收指令并改变自身状态。"""

    def __init__(self, x=1, y=1, heading=90):
        self.x, self.y = x, y
        self.heading = heading
        self.status = "idle"

    def forward(self):
        """无校验前进（测试与巡检内部使用；对外接口请用 forward_checked）。"""
        dx, dy = STEP[self.heading]
        self.x, self.y = self.x + dx, self.y + dy
        return self.x, self.y

    def turn(self, direction):
        """原地转向 90 度，不位移。direction: turn_left / turn_right。"""
        delta = 90 if direction == "turn_right" else -90
        self.heading = (self.heading + delta) % 360
        self.status = "idle"
        return self.heading


def _try_step(robot, nx, ny):
    """共用校验：越界或撞障碍则置 blocked 并保持原位；可走则更新位置置 idle。"""
    if not (0 <= nx < W and 0 <= ny < H):
        robot.status = "blocked"
        return ERROR_OUT_OF_BOUNDS
    if (nx, ny) in OBSTACLES:
        robot.status = "blocked"
        return ERROR_OBSTACLE_BLOCKED
    robot.x, robot.y = nx, ny
    robot.status = "idle"
    return None


def forward_checked(robot):
    """沿当前朝向前进一步。返回 (坐标, 错误码)；失败时位置不变。"""
    dx, dy = STEP[robot.heading]
    err = _try_step(robot, robot.x + dx, robot.y + dy)
    return (robot.x, robot.y), err


def back_checked(robot):
    """沿当前朝向反方向退一步，朝向不变。返回 (坐标, 错误码)；失败时位置不变。"""
    dx, dy = STEP[robot.heading]
    err = _try_step(robot, robot.x - dx, robot.y - dy)
    return (robot.x, robot.y), err
