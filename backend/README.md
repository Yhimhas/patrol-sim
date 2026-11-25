# 后端说明

## 功能与环境

- 已实现的接口和仿真功能（如地图读取、机器人移动、状态查询）为：`GET /api/health`（探活）、`GET /api/map`（读取 16×12 地图与障碍列表）、`GET /api/robot`（查询机器人位置、朝向、运行状态）、`POST /api/robot/move`（发送手动控制指令 forward/back/turn_left/turn_right，含越界与撞障碍的 409 拦截）。
- 后端使用 `FastAPI` 开发，仿真逻辑使用 `simulation/robot.py` 实现（运动校验、状态机 idle/blocked，地图唯一数据源为 `pathplanning/grid_map.py`）。
- 本地运行需要安装 `Python 3 + fastapi + uvicorn`，所需版本为 `Python 3.14.4、fastapi 0.163.0、uvicorn 0.54.0`（版本见 `requirements.txt`，其他 3.x 版本亦可运行）。

## 本地启动流程

1. **进入目录。** 从仓库根目录进入 `backend/`。
2. **安装依赖。** 执行 `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`。
3. **准备配置和初始数据。** 不适用——地图与初始状态内置于代码（机器人初始位于 (1,1)、朝向 90），无需额外配置。
4. **启动后端。** 在 `backend/` 目录执行 `uvicorn app.main:app --reload --port 8000`，服务访问地址为 `http://127.0.0.1:8000`（自助调试页 `http://127.0.0.1:8000/docs`）。启动成功时可以看到 `INFO: Uvicorn running on http://127.0.0.1:8000`。
5. **验证接口。** 按下方示例发出请求，核对状态码和响应内容。联调页面时，按[前端说明](../frontend/README.md)启动前端。

## 接口验证示例

**示例一：发送手动控制指令（前进）**

以下示例假设服务刚启动、机器人处于初始位置 (1,1)、朝向 90；若已执行过其他指令，请先重启服务复位。

- 接口用途为：让机器人沿当前朝向前进一步，返回更新后的位置、朝向与状态。
- 请求方法和路径为：`POST /api/robot/move`。
- 可直接执行的请求命令为：
  ```bash
  curl -s -X POST http://127.0.0.1:8000/api/robot/move -H "Content-Type: application/json" -d '{"action":"forward"}'
  ```
- 预期 HTTP 状态码为 `200`，预期响应内容为 `{"x":2,"y":1,"heading":90,"status":"idle"}`（机器人从初始位置 (1,1) 前进到 (2,1)）。

**示例二：撞障碍时的拦截反馈**

- 接口用途为：验证机器人走到障碍物前时的异常处理。
- 请求方法和路径为：`POST /api/robot/move`（可先用上方命令让机器人前进到 (4,3) 并朝右）。
- 可直接执行的请求命令为：
  ```bash
  curl -s -X POST http://127.0.0.1:8000/api/robot/move -H "Content-Type: application/json" -d '{"action":"forward"}'
  ```
- 预期 HTTP 状态码为 `409`，预期响应内容为 `{"error":{"code":"OBSTACLE_BLOCKED","message":"前方是障碍物，机器人保持原位"}}`——机器人位置不变，状态变为 `blocked`，仍可通过 `GET /api/robot` 查看。

## 构建与检查

- 构建命令为 `pip install -r requirements.txt`（纯 Python 服务，无独立构建产物），产物位置为不适用。
- 测试或检查命令为 `pytest -q`（在 `backend/` 目录、激活 .venv 后执行），当前单元测试全部通过；CI 会在每次提交后自动运行同一检查。
