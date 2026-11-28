"""HTTP 接口测试：状态读取、移动校验、规划、感知、巡检与复位。"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_get_state():
    response = client.get("/api/state")
    assert response.status_code == 200
    body = response.json()
    assert body["map"]["width"] == 12
    assert body["robot"]["x"] == 0
    assert "dir" in body["robot"]
    assert "status" in body["robot"]
    assert "sensor" in body
    assert "patrol" in body


def test_move_success_returns_updated_state():
    response = client.post("/api/move", json={"direction": "right"})
    assert response.status_code == 200
    body = response.json()
    assert body["robot"]["x"] == 1


def test_move_invalid_direction_returns_400():
    response = client.post("/api/move", json={"direction": "north"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_move_malformed_body_returns_400():
    response = client.post("/api/move", content="not-json", headers={"Content-Type": "application/json"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_plan_reachable_returns_path():
    response = client.post("/api/plan", json={"target": {"x": 9, "y": 2}})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert len(body["path"]) > 1


def test_plan_unreachable_returns_reason():
    response = client.post("/api/plan", json={"target": {"x": 99, "y": 99}})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["reason"]


def test_sensor_endpoint():
    response = client.get("/api/sensor")
    assert response.status_code == 200
    body = response.json()
    assert "blocked" in body
    assert "distance" in body


def test_patrol_start_and_stop():
    start = client.post("/api/patrol/start")
    assert start.status_code == 200
    assert start.json()["patrol"]["active"] is True
    stop = client.post("/api/patrol/stop")
    assert stop.status_code == 200
    assert stop.json()["patrol"]["active"] is False


def test_reset():
    client.post("/api/move", json={"direction": "down"})
    response = client.post("/api/reset")
    assert response.status_code == 200
    body = response.json()
    assert body["robot"]["x"] == 0
    assert body["robot"]["y"] == 0


def test_unknown_api_path_returns_404():
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404


def test_return_home_endpoint():
    response = client.post("/api/return-home")
    assert response.status_code == 200
    body = response.json()
    assert body["patrol"]["active"] is True
    assert body["patrol"]["returning"] is True


def test_toggle_obstacle_adds_and_removes():
    first = client.post("/api/map/toggle", json={"x": 5, "y": 5})
    assert first.status_code == 200
    obstacles = {(o["x"], o["y"]) for o in first.json()["map"]["obstacles"]}
    assert (5, 5) in obstacles
    second = client.post("/api/map/toggle", json={"x": 5, "y": 5})
    assert second.status_code == 200
    obstacles2 = {(o["x"], o["y"]) for o in second.json()["map"]["obstacles"]}
    assert (5, 5) not in obstacles2


def test_toggle_obstacle_protected_cell_rejected():
    response = client.post("/api/map/toggle", json={"x": 0, "y": 0})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_dynamic_obstacle_switch():
    on = client.post("/api/map/dynamic", json={"enabled": True})
    assert on.status_code == 200
    off = client.post("/api/map/dynamic", json={"enabled": False})
    assert off.status_code == 200
