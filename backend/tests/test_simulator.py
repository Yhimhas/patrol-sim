"""仿真规则测试：移动校验、朝向、检查点、规划、感知与巡检状态机。"""

import time

import pytest

from app.simulator.simulator import SimError, Simulator
from app.simulator.world import Position


@pytest.fixture()
def sim():
    instance = Simulator(tick_seconds=0.01)
    yield instance
    instance.close()


def test_initial_state(sim: Simulator):
    state = sim.state()
    assert state["robot"]["x"] == 0
    assert state["robot"]["y"] == 0
    assert state["robot"]["dir"] == "right"
    assert state["robot"]["status"] == "idle"
    assert state["patrol"]["completed"] is False


def test_move_four_directions_updates_position_and_dir(sim: Simulator):
    sim.move("right")
    assert sim.state()["robot"] == {
        "x": 1, "y": 0, "dir": "right", "dirLabel": "右", "status": "idle"
    }
    sim.move("down")
    assert sim.state()["robot"]["y"] == 1
    sim.move("left")
    assert sim.state()["robot"]["x"] == 0
    sim.move("up")
    assert sim.state()["robot"]["y"] == 0


def test_out_of_bounds_rejected_and_position_kept(sim: Simulator):
    with pytest.raises(SimError) as exc:
        sim.move("left")
    assert exc.value.code == "out_of_bounds"
    with pytest.raises(SimError) as exc:
        sim.move("up")
    assert exc.value.code == "out_of_bounds"
    state = sim.state()
    assert state["robot"]["x"] == 0
    assert state["robot"]["y"] == 0


def test_obstacle_rejected_and_position_kept(sim: Simulator):
    # (3,2) 是障碍物；先走到 (3,1)，再向下应被挡住。
    sim.move("right")
    sim.move("right")
    sim.move("right")
    sim.move("down")
    # 当前位于 (3,1)，下方 (3,2) 为障碍。
    with pytest.raises(SimError) as exc:
        sim.move("down")
    assert exc.value.code == "obstacle"
    assert sim.state()["robot"]["x"] == 3
    assert sim.state()["robot"]["y"] == 1


def test_invalid_direction_rejected(sim: Simulator):
    with pytest.raises(SimError) as exc:
        sim.move("north")
    assert exc.value.code == "invalid_request"
    assert sim.state()["robot"]["x"] == 0


def test_checkpoint_recorded_once(sim: Simulator):
    # 走到检查点 (2,1)：右、右、下。
    sim.move("right")
    sim.move("right")
    sim.move("down")
    state = sim.state()
    assert {"x": 2, "y": 1} in state["patrol"]["visited"]
    # 再次经过同一检查点不应重复记录。
    sim.move("down")
    sim.move("up")
    assert len(state["patrol"]["visited"]) == 1


def test_plan_returns_path_or_reason(sim: Simulator):
    ok = sim.plan(sim.robot_position(), Position(9, 2))
    assert ok["ok"] is True
    assert ok["path"][0] == {"x": 0, "y": 0}
    assert ok["path"][-1] == {"x": 9, "y": 2}

    blocked = sim.plan(sim.robot_position(), Position(99, 99))
    assert blocked["ok"] is False
    assert blocked["reason"]


def test_sensor_scan_reflects_direction(sim: Simulator):
    reading = sim.state()["sensor"]
    assert reading["direction"] == "right"
    assert "distance" in reading
    assert isinstance(reading["blocked"], bool)


def test_patrol_completes_after_start(sim: Simulator):
    sim.patrol_start()
    # 后台线程以极短步长推进，等待巡检走完所有检查点。
    deadline = time.time() + 5
    while time.time() < deadline:
        state = sim.state()
        if state["patrol"]["completed"]:
            break
        time.sleep(0.02)
    assert state["patrol"]["completed"] is True
    assert len(state["patrol"]["visited"]) == len(state["map"]["checkpoints"])


def test_reset_restores_initial_state(sim: Simulator):
    sim.move("right")
    sim.move("down")
    sim.reset()
    state = sim.state()
    assert state["robot"]["x"] == 0
    assert state["robot"]["y"] == 0
    assert state["patrol"]["visited"] == []


def test_stats_start_at_zero(sim: Simulator):
    stats = sim.state()["stats"]
    assert stats["steps"] == 0
    assert stats["pathLength"] == 0
    assert stats["elapsed"] == 0.0
    assert stats["coverage"] == 0.0


def test_move_increments_steps(sim: Simulator):
    sim.move("right")
    assert sim.state()["stats"]["steps"] == 1


def test_return_home_sets_returning_flag(sim: Simulator):
    sim.move("right")
    sim.move("down")
    snap = sim.return_home()
    assert snap["patrol"]["active"] is True
    assert snap["patrol"]["returning"] is True


def test_toggle_obstacle_blocks_protected_cells(sim: Simulator):
    with pytest.raises(SimError):
        sim.toggle_obstacle(0, 0)  # 起点
    with pytest.raises(SimError):
        sim.toggle_obstacle(2, 1)  # 检查点
    snap = sim.toggle_obstacle(5, 5)
    obstacles = {(o["x"], o["y"]) for o in snap["map"]["obstacles"]}
    assert (5, 5) in obstacles


def test_patrol_completes_and_returns_home(sim: Simulator):
    sim.patrol_start()
    deadline = time.time() + 5
    state = sim.state()
    while time.time() < deadline:
        state = sim.state()
        if state["patrol"]["completed"]:
            break
        time.sleep(0.02)
    assert state["patrol"]["completed"] is True
    assert (state["robot"]["x"], state["robot"]["y"]) == (0, 0)


def test_patrol_accumulates_path_length(sim: Simulator):
    """巡检内部规划必须计入路径长度，否则面板会出现「走 38 步但路径长度 0」。"""
    assert sim.state()["stats"]["pathLength"] == 0
    sim.patrol_start()
    deadline = time.time() + 5
    state = sim.state()
    while time.time() < deadline:
        state = sim.state()
        if state["patrol"]["completed"]:
            break
        time.sleep(0.02)
    assert state["patrol"]["completed"] is True
    stats = state["stats"]
    assert stats["steps"] > 0
    assert stats["pathLength"] >= stats["steps"]


def test_reset_clears_path_length(sim: Simulator):
    sim.plan(sim.robot_position(), Position(9, 2))
    assert sim.state()["stats"]["pathLength"] > 0
    sim.reset()
    assert sim.state()["stats"]["pathLength"] == 0
