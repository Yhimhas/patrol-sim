"""后端 API 路由层。

只做参数校验和格式转换；仿真逻辑在 simulation/（具身智能维护），
地图唯一数据源在 pathplanning/grid_map.py（算法维护）。
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from pathplanning.grid_map import H, OBSTACLES, W
from simulation.robot import Robot, back_checked, forward_checked
from sensors.front import probe

app = FastAPI(title="patrol-sim", version="0.1.0")

# 联调期允许所有来源；结业打包前可收紧
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局唯一的机器人实例（仿真状态在内存中）
robot = Robot(x=1, y=1, heading=90)

ERROR_MESSAGES = {
    "OUT_OF_BOUNDS": "目标越出地图边界，机器人保持原位",
    "OBSTACLE_BLOCKED": "前方是障碍物，机器人保持原位",
}


class MoveRequest(BaseModel):
    action: str


def robot_state() -> dict:
    return {
        "x": robot.x,
        "y": robot.y,
        "heading": robot.heading,
        "status": robot.status,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/map")
def get_map():
    return {"width": W, "height": H, "obstacles": [[x, y] for x, y in sorted(OBSTACLES)]}


@app.get("/api/robot")
def get_robot():
    return robot_state()


@app.post("/api/robot/move")
def move(req: MoveRequest):
    if req.action in ("forward", "back") and patrol_state["worker"] is not None \
       and patrol_state["worker"].is_alive():
        return JSONResponse(
            status_code=409,
            content={"error": {"code": "PATROL_BLOCKED",
                     "message": "巡检进行中，请先停止巡检再手动控制"}},
        )

    if robot.status == "patrolling":
        return JSONResponse(
            status_code=409,
            content={
                "error": {
                    "code": "PATROL_ALREADY_RUNNING",
                    "message": "巡检进行中，请点「停止巡检」后再手动控制"}},
    )
    if req.action in ("turn_left", "turn_right"):
        robot.turn(req.action)
        return robot_state()

    if req.action not in ("forward", "back"):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_ACTION",
                    "message": f"不支持的指令：{req.action}（可选 forward/back/turn_left/turn_right）",
                }
            },
        )

    _, err = forward_checked(robot) if req.action == "forward" else back_checked(robot)
    if err:
        return JSONResponse(
            status_code=409,
            content={"error": {"code": err, "message": ERROR_MESSAGES[err]}},
        )
    return robot_state()



@app.get("/api/sensors/front")
def sensors_front():
    """契约接口：沿当前朝向逐格探测，返回 blocked 与 distance"""
    return probe(robot.x, robot.y, robot.heading)

# ---------- 巡检调度（算法方向维护）：11.19 由具身智能临时接管挂载，patrol.py 与测试明天由算法补交 ----------
import threading
import time as _time

from pathplanning.patrol import patrol_progress, plan_patrol


class PatrolRequest(BaseModel):
    points: list


ERROR_MESSAGES.update({
    "PATROL_ALREADY_RUNNING": "巡检已在进行中，请先停止再启动",
    "TARGET_UNREACHABLE": "巡检点不可达（被围死或越界），机器人保持原位",
})

patrol_lock = threading.Lock()
patrol_state = {"worker": None, "segs": None, "walked": 0, "stop": False}


def _walk_patrol():
    """后台线程：沿预算好的分段路径逐格走，0.4 秒一格。"""
    robot.status = "patrolling"
    segs = patrol_state["segs"]
    for i, seg in enumerate(segs):
        patrol_state["walked"] = i
        for cell in seg[1:]:
            if patrol_state["stop"]:
                robot.status = "idle"
                return
            _time.sleep(0.4)
            robot.x, robot.y = cell
    robot.status = "idle"
    patrol_state["walked"] = len(segs)


@app.post("/api/patrol/start")
def patrol_start(req: PatrolRequest):
    with patrol_lock:
        if patrol_state["worker"] is not None and patrol_state["worker"].is_alive():
            return JSONResponse(
                status_code=409,
                content={"error": {"code": "PATROL_ALREADY_RUNNING",
                         "message": ERROR_MESSAGES["PATROL_ALREADY_RUNNING"]}},
            )
        points = [tuple(pt) for pt in req.points]
        segs = plan_patrol((robot.x, robot.y), points)
        if segs is None:
            return JSONResponse(
                status_code=409,
                content={"error": {"code": "TARGET_UNREACHABLE",
                         "message": ERROR_MESSAGES["TARGET_UNREACHABLE"]}},
            )
        patrol_state.update({"segs": segs, "walked": 0, "stop": False})
        thread = threading.Thread(target=_walk_patrol, daemon=True)
        patrol_state["worker"] = thread
        thread.start()
        return {"total": len(segs),
                "steps": sum(len(s) - 1 for s in segs),
                "status": "patrolling"}


@app.post("/api/patrol/stop")
def patrol_stop():
    with patrol_lock:
        patrol_state["stop"] = True
    return robot_state()


@app.get("/api/patrol/progress")
def patrol_progress_route():
    segs = patrol_state["segs"]
    if segs is None:
        return {"active": False, "total": 0, "current": 0, "done": False}
    alive = patrol_state["worker"] is not None and patrol_state["worker"].is_alive()
    prog = patrol_progress(segs, min(patrol_state["walked"], len(segs) - 1))
    prog["done"] = prog["done"] or not alive
    return {"active": alive, **prog}


# 结业打包时（运维）在下面挂载前端静态产物，本地联调保持注释：
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="static", html=True), name="static")
