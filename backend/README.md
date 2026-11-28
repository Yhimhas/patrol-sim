# 后端说明

## 功能与环境

- 已实现：地图与机器人状态查询、四方向手动移动校验、A* 路径规划、前方障碍传感器、自动巡检状态机、复位；巡检返航、运行统计（步数/路径长度/耗时/覆盖率）、地图障碍增删切换、动态障碍开关与受阻自动重规划。
- 后端使用 Python 3.13 + FastAPI + Uvicorn；仿真逻辑在 `app/simulator/`，不依赖 HTTP 或浏览器，可独立测试。
- 本地运行需要 Python 3.13 及以上版本。

## 本地启动流程

1. **进入项目根目录**，创建虚拟环境并安装依赖：

   ```powershell
   python -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   ```

2. **启动后端**（项目根目录执行）：

   ```powershell
   .venv\Scripts\python -m uvicorn app.main:app --app-dir backend --reload --port 8000
   ```

   服务地址为 `http://localhost:8000`，接口文档见 `http://localhost:8000/api/docs`。

## 接口验证示例

- **获取状态**：`GET /api/state`，返回地图、机器人坐标/朝向/状态、传感器读数与巡检进度。
- **手动移动**：

  ```powershell
  Invoke-RestMethod -Method Post http://localhost:8000/api/move `
    -ContentType "application/json" -Body '{"direction":"right"}'
  ```

  成功返回移动后的完整状态；越界返回 `409 out_of_bounds`，撞墙返回 `409 obstacle`，非法方向返回 `400 invalid_request`。

- **路径规划**：`POST /api/plan`，请求体 `{"target":{"x":9,"y":2}}`，返回 `{ok, path, reason}`。
- **传感器读数**：`GET /api/sensor`。
- **自动巡检**：`POST /api/patrol/start`、`POST /api/patrol/stop`。
- **手动返航**：`POST /api/return-home`，规划并返回起点。
- **切换障碍**：`POST /api/map/toggle`，请求体 `{"x":5,"y":5}`，在该格放置或移除障碍。
- **动态障碍开关**：`POST /api/map/dynamic`，请求体 `{"enabled":true}`，开启后障碍后台随机扰动。
- **复位**：`POST /api/reset`。

## 构建与检查

```powershell
pytest backend
python -m compileall -q backend/app
```
