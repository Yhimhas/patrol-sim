# 公网部署报名｜我不会喵喵叫!

- 小组或个人：我不会喵喵叫!
- 项目简介：基于 Web 的智能巡检机器人二维仿真系统。浏览器操作 30×30 网格地图上的巡检机器人，C++（Crow）后端统一维护地图、位姿与移动规则；支持四方向逐格控制、边界与障碍阻挡、自动巡检（Boustrophedon 单元分解 + 贪心 BFS 取较短路径，可随时停止、遇障自动绕行）以及虚拟感知（三向测距、四类异常按曼哈顿距离触发事件流）。前端 React + Canvas 同源托管，Docker 三阶段构建，镜像发布 GHCR。
- 完成内容：
  - 手动控制：四方向逐格移动，请求串行、序列号 sequence 单调递增。
  - 边界保护：越界时位置不变、朝向更新，返回 BLOCKED_BOUNDARY，不锁死，下一次合法移动恢复 IDLE。
  - 障碍阻挡：撞障碍返回 BLOCKED_OBSTACLE，规则与边界一致。
  - 自动巡检：Boustrophedon 单元分解与贪心 BFS 两种规划取较短路径，可随时停止，途中遇障碍或边界自动重规划绕行。
  - 虚拟感知：前/左/右三向测距逐格命中即停；烟雾、高温、气体泄漏、油污泄漏按曼哈顿距离判定进入/离开，输出 ANOMALY_DETECTED / ANOMALY_OUT_OF_RANGE 事件，独立感知面板展示。
  - 重置：恢复配置初始位姿，sequence 继续累加不归零，异常源位置重新随机。
  - 工程质量：CTest（C++ 单测）+ Vitest（前端单测）+ pytest（接口黑盒）三层测试；CI 三 job，CD 推送 GHCR 并记录 digest；运行时非 root（uid 10001）。
- 镜像：ghcr.io/zane372/web-based-intelligent-inspection-robot@sha256:989e4a74f533003c36466f50da4d3acb20b307b4acfd8d4a62fd575a55e2db6d
- 容器端口：8080
- 环境变量名称：APP_HOST, PERCEPTION_CONFIG
- 验证路径：/

## 补充材料

- 项目仓库：https://github.com/zane372/Web-based-Intelligent-Inspection-Robot
- 演示方式：浏览器打开首页 `/`；左侧 30×30 网格地图，右侧读数面板 / 方向键 / 自动巡检 / 重置 / 虚拟感知面板。建议顺序：四方向各走一格 → 左上角按「↑」看边界反馈 → 走到 (4,3) 按「↓」看障碍阻挡 → 点「自动巡检」看绕行与感知事件 → 点「重置」。
- 健康检查：`GET /api/v1/health`；状态核对：`GET /api/v1/robot`（与页面 position / heading / motionStatus / sequence 一致）。
- 环境变量建议值（字段栏只填名称，实际值在此说明）：`APP_HOST=0.0.0.0`（程序默认 127.0.0.1，只监听回环会导致外部访问不到）、`PERCEPTION_CONFIG=/app/config/perception.json`（不设则虚拟感知关闭）。其余 `APP_PORT=8080`、`MAP_CONFIG=/app/config/map.json`、`STATIC_ROOT=/app/web` 已与镜像内默认值一致，无需配置。
- 本地验证记录（2026-11-26）：`docker run --platform linux/amd64 -p 8080:8080 -e APP_HOST=0.0.0.0 -e PERCEPTION_CONFIG=/app/config/perception.json ghcr.io/zane372/web-based-intelligent-inspection-robot@sha256:989e4a74f533003c36466f50da4d3acb20b307b4acfd8d4a62fd575a55e2db6d` 启动后，`/api/v1/health` 200；初始态 (0,0)/RIGHT/IDLE/sequence=0；四方向移动正常；(0,0) 按 UP 返回 BLOCKED_BOUNDARY 且位置不变；(4,3) 按 DOWN 返回 BLOCKED_OBSTACLE；START_PATROL 后机器人自动移动、STOP_PATROL 正常停止；感知三向测距与事件流有数据；RESET 回到 (0,0)；非法方向返回 400 INVALID_DIRECTION。
- 运行说明：`docs/demo/演示脚本.md`、`docs/部署报名提交说明.md`（项目仓库内）。
- CI：https://github.com/zane372/Web-based-Intelligent-Inspection-Robot/actions

## 报名确认

- [x] 场景与核心功能已在上方写明
- [x] 已用该镜像摘要 + 容器端口在本地启动，并在浏览器验证首页与核心功能
- [x] PR 目标为 Yhimhas/patrol-sim:main，标题与来源分支符合规则
- [x] 环境变量只填名称，未在公开内容中写入实际值