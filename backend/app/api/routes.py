"""HTTP 路由：解析请求、调用仿真逻辑、组织 JSON 响应。

业务规则全部留在 simulator 层；本文件不判断能否移动，只做参数承接和错误映射。
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..simulator.simulator import SimError, Simulator
from ..simulator.world import Position


class Point(BaseModel):
    x: int
    y: int


class MoveRequest(BaseModel):
    direction: str


class PlanRequest(BaseModel):
    target: Point
    start: Point | None = None


class DynamicObstacleRequest(BaseModel):
    enabled: bool


def create_router(sim: Simulator) -> APIRouter:
    router = APIRouter()

    @router.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    @router.get("/api/state")
    def get_state() -> dict:
        return sim.state()

    @router.post("/api/move", response_model=None)
    def move(req: MoveRequest):
        try:
            return sim.move(req.direction)
        except SimError as err:
            return _error(err.http_status, err.code, err.message)

    @router.post("/api/plan")
    def plan(req: PlanRequest) -> dict:
        start = (
            Position(req.start.x, req.start.y)
            if req.start is not None
            else sim.robot_position()
        )
        return sim.plan(start, Position(req.target.x, req.target.y))

    @router.get("/api/sensor")
    def sensor() -> dict:
        return sim.state()["sensor"]

    @router.post("/api/patrol/start")
    def patrol_start() -> dict:
        return sim.patrol_start()

    @router.post("/api/patrol/stop")
    def patrol_stop() -> dict:
        return sim.patrol_stop()

    @router.post("/api/reset")
    def reset() -> dict:
        return sim.reset()

    @router.post("/api/return-home")
    def return_home() -> dict:
        return sim.return_home()

    @router.post("/api/map/toggle", response_model=None)
    def toggle_obstacle(req: Point):
        try:
            return sim.toggle_obstacle(req.x, req.y)
        except SimError as err:
            return _error(err.http_status, err.code, err.message)

    @router.post("/api/map/dynamic")
    def set_dynamic(req: DynamicObstacleRequest) -> dict:
        return sim.set_dynamic_obstacles(req.enabled)

    return router


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )
