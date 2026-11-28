"""地图世界：网格尺寸、障碍物、检查点与可通行判断。

坐标系约定：左上角为 (0, 0)，x 向右递增，y 向下递增，单位为一格。
地图、障碍物和初始位置由后端统一定义，前端只负责绘制，不另存一份地图配置。
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Position:
    """网格坐标。frozen 保证坐标值不会被内部意外修改。"""

    x: int
    y: int

    def as_dict(self) -> dict:
        return {"x": self.x, "y": self.y}

    @classmethod
    def from_dict(cls, data: dict) -> "Position":
        return cls(x=int(data["x"]), y=int(data["y"]))


class World:
    """固定的二维巡检地图。"""

    def __init__(
        self,
        width: int,
        height: int,
        obstacles: list[Position],
        checkpoints: list[Position],
        start: Position,
    ) -> None:
        self.width = width
        self.height = height
        self.obstacles = set(obstacles)
        self.checkpoints = list(checkpoints)
        self.start = start
        self._validate()

    def _validate(self) -> None:
        """演示数据自检：点位必须在地图内，障碍不能覆盖起点，检查点不能与障碍重合。"""
        if self.width < 1 or self.height < 1:
            raise ValueError("地图宽高必须为正整数")
        for point in self.obstacles:
            if not self.in_bounds(point):
                raise ValueError(f"障碍物 {point} 超出地图边界")
        if self.start in self.obstacles:
            raise ValueError("起点不能落在障碍物上")
        if not self.in_bounds(self.start):
            raise ValueError("起点超出地图边界")
        for point in self.checkpoints:
            if not self.in_bounds(point):
                raise ValueError(f"检查点 {point} 超出地图边界")
            if point in self.obstacles:
                raise ValueError(f"检查点 {point} 与障碍物重合")

    def in_bounds(self, point: Position) -> bool:
        return 0 <= point.x < self.width and 0 <= point.y < self.height

    def is_obstacle(self, point: Position) -> bool:
        return point in self.obstacles

    def passable(self, point: Position) -> bool:
        return self.in_bounds(point) and point not in self.obstacles

    def add_obstacle(self, point: Position) -> None:
        """在指定格放置障碍；非法位置抛出 ValueError。"""
        if not self.in_bounds(point):
            raise ValueError(f"障碍物 {point} 超出地图边界")
        if point == self.start:
            raise ValueError("起点不能放置障碍物")
        if point in self.checkpoints:
            raise ValueError("检查点不能放置障碍物")
        self.obstacles.add(point)

    def remove_obstacle(self, point: Position) -> None:
        self.obstacles.discard(point)

    def toggle_obstacle(self, point: Position) -> bool:
        """切换障碍状态，切换后返回该格是否为障碍。"""
        if point in self.obstacles:
            self.remove_obstacle(point)
            return False
        self.add_obstacle(point)
        return True

    def to_dict(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "obstacles": [p.as_dict() for p in sorted(self.obstacles, key=lambda p: (p.y, p.x))],
            "checkpoints": [p.as_dict() for p in self.checkpoints],
            "start": self.start.as_dict(),
        }


# 四个朝向对应的单位向量。顺序与接口允许的 direction 取值保持一致。
DIRECTIONS: dict[str, tuple[int, int]] = {
    "up": (0, -1),
    "down": (0, 1),
    "left": (-1, 0),
    "right": (1, 0),
}

DIRECTION_LABELS: dict[str, str] = {
    "up": "上",
    "down": "下",
    "left": "左",
    "right": "右",
}


def default_world() -> World:
    """默认演示地图：12 × 10，含墙体、起点和 4 个检查点，起点可到达全部检查点。"""
    obstacles = [
        # 左侧竖向墙体
        Position(3, 2), Position(3, 3), Position(3, 4),
        # 中部横向墙体（留缺口）
        Position(6, 1), Position(6, 2), Position(6, 3),
        # 右下竖向墙体
        Position(8, 5), Position(8, 6), Position(8, 7),
        # 下方横向墙体
        Position(2, 8), Position(3, 8), Position(4, 8),
    ]
    checkpoints = [
        Position(2, 1),
        Position(9, 2),
        Position(10, 8),
        Position(5, 6),
    ]
    return World(
        width=12,
        height=10,
        obstacles=obstacles,
        checkpoints=checkpoints,
        start=Position(0, 0),
    )
