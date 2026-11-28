# 项目协作约定

- 项目目标：完成基础版并实现路径规划、传感器、异常处理、自动巡检等标准版专项。
- 目录职责：地图与仿真规则在 `backend/app/simulator/`，HTTP 接口在 `backend/app/api/`，页面在 `frontend/`，结课材料在 `docs/`。
- 数据约定：坐标原点左上角，`x` 向右、`y` 向下；机器人字段 `x/y/dir/dirLabel/status`；错误响应统一为 `{"error":{"code","message"}}`。
- 常用验证：`pytest backend`；`python -m compileall -q backend/app`；本地用 `uvicorn app.main:app --app-dir backend --port 8000` 启动。
- 边界：仿真规则不依赖 HTTP 与浏览器；前端只按后端响应绘制，不在本地判断移动能否成功。
