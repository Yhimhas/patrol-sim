"""地图数据与可通行判断的单元测试。"""

from app.simulator.world import Position, default_world


def test_default_map_is_valid():
    world = default_world()
    assert world.width == 12
    assert world.height == 10
    # 障碍物、检查点都在地图内，且不覆盖起点。
    for obstacle in world.obstacles:
        assert world.in_bounds(obstacle)
    for checkpoint in world.checkpoints:
        assert world.in_bounds(checkpoint)
        assert not world.is_obstacle(checkpoint)
    assert world.passable(world.start)


def test_passable_rules():
    world = default_world()
    assert world.passable(Position(0, 0))
    assert not world.passable(Position(-1, 0))
    assert not world.passable(Position(world.width, 0))
    obstacle = next(iter(world.obstacles))
    assert not world.passable(obstacle)
