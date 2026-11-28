"""A* 路径规划测试：可达绕障、不可达判定。"""

from app.simulator import planner
from app.simulator.world import Position, World


def test_plan_straight_path():
    world = default_world_empty()
    path = planner.plan(world, Position(0, 0), Position(2, 3))
    assert path is not None
    assert path[0] == Position(0, 0)
    assert path[-1] == Position(2, 3)
    assert len(path) == 6  # 曼哈顿距离 5 + 起点


def test_plan_avoids_obstacle():
    world = World(
        width=5,
        height=5,
        obstacles=[Position(2, 1), Position(2, 2), Position(2, 3)],
        checkpoints=[],
        start=Position(0, 0),
    )
    path = planner.plan(world, Position(0, 0), Position(4, 2))
    assert path is not None
    # 路径上不能出现障碍物格。
    for point in path:
        assert not world.is_obstacle(point)


def test_plan_unreachable_when_enclosed():
    # 目标格被障碍与边界完全隔离，A* 无法到达。
    enclosed = World(
        width=3,
        height=3,
        obstacles=[Position(0, 1), Position(1, 0), Position(1, 1), Position(1, 2), Position(2, 1)],
        checkpoints=[],
        start=Position(0, 0),
    )
    assert planner.plan(enclosed, Position(0, 0), Position(2, 2)) is None


def test_plan_rejects_blocked_endpoints():
    world = default_world_empty()
    assert planner.plan(world, Position(-1, 0), Position(2, 2)) is None
    assert planner.plan(world, Position(0, 0), Position(99, 99)) is None


def default_world_empty() -> World:
    return World(width=6, height=6, obstacles=[], checkpoints=[], start=Position(0, 0))
