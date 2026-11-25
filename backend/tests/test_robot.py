"""仿真模块单元测试（CI 与 G2 验收依据）。"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulation.robot import (  # noqa: E402
    ERROR_OBSTACLE_BLOCKED,
    ERROR_OUT_OF_BOUNDS,
    Robot,
    back_checked,
    forward_checked,
)


def test_forward_right_updates_position():
    assert Robot(1, 1, 90).forward() == (2, 1)


def test_turn_left_and_right():
    r = Robot(1, 1, 0)
    assert r.turn("turn_right") == 90
    assert r.turn("turn_left") == 0


def test_out_of_bounds_keeps_position():
    r = Robot(1, 0, 0)  # 顶行朝上，前方 (1,-1) 越界
    pos, err = forward_checked(r)
    assert err == ERROR_OUT_OF_BOUNDS
    assert pos == (1, 0)
    assert r.status == "blocked"


def test_obstacle_blocked_keeps_position():
    r = Robot(5, 2, 180)  # 前方 (5,3) 是障碍
    pos, err = forward_checked(r)
    assert err == ERROR_OBSTACLE_BLOCKED
    assert pos == (5, 2)
    assert r.status == "blocked"


def test_back_success_keeps_heading():
    r = Robot(2, 1, 90)  # 朝右时后退回到 (1,1)，朝向不变
    pos, err = back_checked(r)
    assert err is None
    assert pos == (1, 1)
    assert r.heading == 90
    assert r.status == "idle"
