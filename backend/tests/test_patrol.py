from pathplanning.patrol import plan_patrol, patrol_progress


def test_points_in_order_segments():
    result = plan_patrol((1, 1), [(4, 4), (8, 8), (12, 10)])
    assert result is not None
    assert len(result) == 3
    assert result[0][0] == (1, 1)
    assert result[-1][-1] == (12, 10)
    assert patrol_progress(result, 0) == {"total": 3, "current": 1, "done": False}
    assert patrol_progress(result, 3)["done"] is True


def test_blocked_point_returns_none():
    assert plan_patrol((1, 1), [(5, 3)]) is None
