"""仿真核心：持有内存地图与机器人状态，处理移动、规划、感知与自动巡检。

本模块不依赖 HTTP 或浏览器，规则可脱离接口独立测试。共享状态由一把锁保护，
后台巡检线程与接口请求通过同一把锁串行访问内部数据。
"""

import random
import threading
import time

from . import planner, sensor
from .world import DIRECTIONS, DIRECTION_LABELS, Position, World, default_world


class SimError(Exception):
    """仿真规则错误，携带供接口层映射的错误码和中文提示。"""

    def __init__(self, code: str, message: str, http_status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


def _direction_between(a: Position, b: Position) -> str:
    dx, dy = b.x - a.x, b.y - a.y
    for name, vec in DIRECTIONS.items():
        if vec == (dx, dy):
            return name
    return "right"


class Simulator:
    """同一服务实例共享一个机器人状态，不按浏览器划分会话。"""

    def __init__(
        self,
        world: World | None = None,
        tick_seconds: float = 0.3,
        dynamic_obstacles: bool = False,
    ) -> None:
        self._world = world or default_world()
        self._lock = threading.Lock()
        self._robot_pos = self._world.start
        self._robot_dir = "right"
        self._robot_status = "idle"
        self._visited: list[Position] = []
        self._patrol_active = False
        self._patrol_completed = False
        self._patrol_path: list[Position] = []
        self._patrol_target: Position | None = None
        self._patrol_message = ""
        self._returning = False

        # 运行统计：手动/巡检移动的步数、累计规划路径长度、起步时间。
        self._steps = 0
        self._path_length = 0
        self._started_at: float | None = None

        self._dynamic_obstacles = dynamic_obstacles
        self._obstacle_tick = 0

        self._stop_event = threading.Event()
        self._tick = tick_seconds
        self._thread = threading.Thread(target=self._patrol_loop, daemon=True)
        self._thread.start()

    # ---------- 状态读取 ----------

    def robot_position(self) -> Position:
        with self._lock:
            return self._robot_pos

    def state(self) -> dict:
        with self._lock:
            return self._snapshot()

    def _snapshot(self) -> dict:
        return {
            "map": self._world.to_dict(),
            "robot": {
                "x": self._robot_pos.x,
                "y": self._robot_pos.y,
                "dir": self._robot_dir,
                "dirLabel": DIRECTION_LABELS[self._robot_dir],
                "status": self._robot_status,
            },
            "sensor": sensor.scan(self._world, self._robot_pos, self._robot_dir),
            "patrol": {
                "active": self._patrol_active,
                "completed": self._patrol_completed,
                "visited": [p.as_dict() for p in self._visited],
                "target": self._patrol_target.as_dict() if self._patrol_target else None,
                "message": self._patrol_message,
                "returning": self._returning,
            },
            "stats": {
                "steps": self._steps,
                "pathLength": self._path_length,
                "elapsed": self._elapsed_seconds(),
                "coverage": self._coverage(),
            },
        }

    def _elapsed_seconds(self) -> float:
        if self._started_at is None:
            return 0.0
        return round(time.time() - self._started_at, 1)

    def _coverage(self) -> float:
        total = len(self._world.checkpoints)
        if total == 0:
            return 1.0
        return round(len(self._visited) / total, 2)

    # ---------- 手动控制 ----------

    def move(self, direction: str) -> dict:
        with self._lock:
            if direction not in DIRECTIONS:
                self._robot_status = "blocked"
                raise SimError("invalid_request", "方向有误，请使用上、下、左、右四个方向", 400)

            dx, dy = DIRECTIONS[direction]
            target = Position(self._robot_pos.x + dx, self._robot_pos.y + dy)

            if not self._world.in_bounds(target):
                self._robot_status = "blocked"
                self._stop_patrol_locked()
                raise SimError("out_of_bounds", "已到地图边界，无法继续向该方向移动", 409)
            if self._world.is_obstacle(target):
                self._robot_status = "blocked"
                self._stop_patrol_locked()
                raise SimError("obstacle", "前方有障碍物，无法移动", 409)

            # 校验全部通过后才更新位置；被拒绝的指令不会改变状态。
            self._robot_pos = target
            self._robot_dir = direction
            self._robot_status = "idle"
            self._record_checkpoint(target)
            self._steps += 1
            self._touch_clock()
            # 手动操作视为人工接管，终止正在进行的自动巡检。
            self._stop_patrol_locked()
            return self._snapshot()

    # ---------- 路径规划 ----------

    def plan(self, start: Position, goal: Position) -> dict:
        with self._lock:
            if not self._world.in_bounds(start) or not self._world.in_bounds(goal):
                return {"ok": False, "path": [], "reason": "起点或目标点在地图范围之外"}
            if self._world.is_obstacle(start) or self._world.is_obstacle(goal):
                return {"ok": False, "path": [], "reason": "起点或目标点位于障碍物上"}
            path = self._plan_and_count_locked(start, goal)
            if path is None:
                return {"ok": False, "path": [], "reason": "目标点不可达，中间被边界或障碍物隔开"}
            return {"ok": True, "path": [p.as_dict() for p in path], "reason": ""}

    def _plan_and_count_locked(self, start: Position, goal: Position):
        """统一的规划入口：成功规划出的路径计入累计路径长度。"""
        path = planner.plan(self._world, start, goal)
        if path is not None:
            self._path_length += len(path)
        return path

    def _touch_clock(self) -> None:
        if self._started_at is None:
            self._started_at = time.time()

    # ---------- 自动巡检 ----------

    def patrol_start(self) -> dict:
        with self._lock:
            if self._patrol_active:
                self._patrol_message = "巡检已在进行中"
                return self._snapshot()
            self._visited = []
            self._patrol_completed = False
            self._patrol_path = []
            self._patrol_target = None
            self._returning = False
            self._patrol_active = True
            self._patrol_message = "正在按顺序前往检查点…"
            self._robot_status = "moving"
            return self._snapshot()

    def patrol_stop(self) -> dict:
        with self._lock:
            self._stop_patrol_locked()
            self._robot_status = "idle"
            self._patrol_message = "巡检已手动停止"
            return self._snapshot()

    def return_home(self) -> dict:
        """手动返航：结束当前巡检，规划并行进回起点。"""
        with self._lock:
            self._stop_patrol_locked()
            self._returning = True
            self._patrol_active = True
            self._robot_status = "moving"
            self._patrol_message = "正在返航返回起点…"
            return self._snapshot()

    def toggle_obstacle(self, x: int, y: int) -> dict:
        """在指定格放置或移除障碍；受保护格（起点/检查点/机器人）不允许改动。"""
        point = Position(x, y)
        if not self._world.in_bounds(point):
            raise SimError("out_of_bounds", "该格在地图范围之外，不能编辑", 409)
        if point == self._world.start:
            raise SimError("invalid_request", "起点不能放置障碍物", 400)
        if point in self._world.checkpoints:
            raise SimError("invalid_request", "检查点不能放置障碍物", 400)
        if point == self._robot_pos:
            raise SimError("invalid_request", "机器人所在格不能放置障碍物", 400)
        added = self._world.toggle_obstacle(point)
        self._patrol_path = []
        return self._snapshot()

    def set_dynamic_obstacles(self, enabled: bool) -> dict:
        self._dynamic_obstacles = enabled
        return self.state()

    def reset(self) -> dict:
        with self._lock:
            self._robot_pos = self._world.start
            self._robot_dir = "right"
            self._robot_status = "idle"
            self._visited = []
            self._stop_patrol_locked()
            self._patrol_completed = False
            self._steps = 0
            self._path_length = 0
            self._started_at = None
            self._patrol_message = "已复位到初始位置"
            return self._snapshot()

    # ---------- 巡检后台线程 ----------

    def _patrol_loop(self) -> None:
        while not self._stop_event.is_set():
            with self._lock:
                self._patrol_tick_locked()
                self._disturb_obstacles_locked()
            time.sleep(self._tick)

    def _disturb_obstacles_locked(self) -> None:
        """可选的动态障碍：每隔若干 tick 随机把一处障碍挪到相邻合法格。"""
        if not self._dynamic_obstacles:
            return
        self._obstacle_tick += 1
        if self._obstacle_tick % 3 != 0:
            return
        obstacles = list(self._world.obstacles)
        if not obstacles:
            return
        src = random.choice(obstacles)
        candidates = []
        for dx, dy in DIRECTIONS.values():
            nxt = Position(src.x + dx, src.y + dy)
            if not self._world.in_bounds(nxt):
                continue
            if nxt == self._world.start or nxt in self._world.checkpoints:
                continue
            if nxt == self._robot_pos or nxt in self._world.obstacles:
                continue
            candidates.append(nxt)
        if not candidates:
            return
        dst = random.choice(candidates)
        self._world.remove_obstacle(src)
        self._world.add_obstacle(dst)

    def _patrol_tick_locked(self) -> None:
        if not self._patrol_active:
            return

        # 1. 沿已规划路径前进一步；被新障碍截断时丢弃旧路径，稍后重新规划。
        if self._patrol_path:
            nxt = self._patrol_path.pop(0)
            if not self._world.passable(nxt):
                self._patrol_path = []
            else:
                self._robot_dir = _direction_between(self._robot_pos, nxt)
                self._robot_pos = nxt
                self._robot_status = "moving"
                self._record_checkpoint(nxt)
                self._steps += 1
                self._touch_clock()
                return

        # 2. 返航阶段：规划回到起点，到达后结束。
        if self._returning:
            if self._robot_pos == self._world.start:
                self._patrol_active = False
                self._patrol_completed = True
                self._robot_status = "idle"
                self._patrol_message = "巡检完成：已全部到达并返回起点"
                return
            path = self._plan_and_count_locked(self._robot_pos, self._world.start)
            if path is None:
                self._patrol_active = False
                self._robot_status = "error"
                self._patrol_message = "返航路径受阻，巡检已停止"
                return
            self._patrol_target = self._world.start
            self._patrol_path = path[1:]
            return

        # 3. 检查点全部走完后转入返航；否则规划到下一个未访问检查点。
        target = next((c for c in self._world.checkpoints if c not in self._visited), None)
        if target is None:
            self._returning = True
            self._patrol_message = "检查点已全部到达，正在返航…"
            path = self._plan_and_count_locked(self._robot_pos, self._world.start)
            if path is None:
                self._patrol_active = False
                self._robot_status = "error"
                self._patrol_message = "返航路径受阻，巡检已停止"
                return
            self._patrol_target = self._world.start
            self._patrol_path = path[1:]
            return

        path = self._plan_and_count_locked(self._robot_pos, target)
        if path is None:
            self._patrol_active = False
            self._robot_status = "error"
            self._patrol_target = target
            self._patrol_message = f"检查点 ({target.x}, {target.y}) 不可达，巡检已停止"
            return

        self._patrol_target = target
        self._patrol_path = path[1:]  # 去掉起点本身

    def _record_checkpoint(self, pos: Position) -> None:
        if pos in self._world.checkpoints and pos not in self._visited:
            self._visited.append(pos)

    def _stop_patrol_locked(self) -> None:
        self._patrol_active = False
        self._patrol_path = []
        self._patrol_target = None
        self._returning = False

    def close(self) -> None:
        """服务关闭时结束后台线程。"""
        self._stop_event.set()
        self._thread.join(timeout=1)
