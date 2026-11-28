# 智能巡检机器人 · 二维仿真

基于 Web 的智能巡检机器人二维仿真系统：15 × 10 网格地图、手动/自动巡检、BFS 与 A* 路径规划、检查点、搜索过程动画与实时状态面板。

界面采用马里奥像素游戏风格（天空、草地、金币与砖块），前后端通过 `shared/api.interface.ts` 共享类型。

## 启动

```bash
npm install
npm run dev        # 同时启动 NestJS (3000) 与 Vite 开发服务器 (8080)
```

生产构建：

```bash
npm run build
npm start
```

## Docker 部署

```bash
# 构建镜像（linux/amd64）
docker build --platform linux/amd64 -t patrol-sim .

# 启动容器，本机 8080 映射到容器 3000 端口
docker run --rm -p 127.0.0.1:8080:3000 patrol-sim
```

验证：打开 `http://127.0.0.1:8080/` 查看仿真页面，`http://127.0.0.1:8080/api/health` 返回 `{"status":"ok"}`。容器内服务端口为 `3000`，内置独立运行所需默认配置，无需额外环境变量。

常用检查：

```bash
npm run type:check
npm run lint
```

回归冒烟（先编译后端，再用编译产物验证移动规则、BFS/A*、检查点与 DTO 校验）：

```bash
npm run build:server
node scripts/smoke-test.cjs
```

## 目录

```
shared/
  api.interface.ts   前后端共享类型与常量（方向、格子、检查点上限等）
  grid.ts            移动规则的唯一实现（越界/障碍/电量判断、路径转方向）
server/modules/
  robot/             地图与机器人状态（内存态）、移动、重置
  path/              BFS / A* 路径规划，检查点分段串联
client/src/pages/patrol-simulator/
  PatrolSimulatorPage.tsx  状态编排、请求串行化、自动巡检、键盘控制
  MapCanvas.tsx            单 rAF 循环的 Canvas 渲染（网格、机器人、搜索动画、路径）
  coins.ts                 金币 key、动画时长等共享常量
  useCoinCollection.ts     金币收集/回滚/复位与爆金币动画生命周期
  StatusPanel.tsx          状态监测
  ControlPanel.tsx         手动控制
  PathPanel.tsx            算法、检查点、速度、规划与巡检
```

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/map` | 获取地图（含起点/终点） |
| GET | `/api/robot` | 获取机器人状态 |
| POST | `/api/robot/move` | `{ direction }` 单步移动，返回是否成功 |
| POST | `/api/robot/reset` | 重置机器人 |
| POST | `/api/path/plan` | `{ algorithm, start, end, checkpoints? }` 路径规划 |

请求体由全局 `ValidationPipe` 校验（`whitelist + transform`）；路径规划最多支持 2 个检查点。

## 关键设计

- **服务端为权威状态**：手动移动采用本地乐观更新，但所有请求串行发送，队列清空后按服务端状态校准；自动巡检每一步都等待服务端成功响应，因此刷新页面或重新打开不会出现位置回退。
- **移动规则只写一份**：客户端与后端都调用 `shared/grid.ts` 的 `evaluateMove`，避免"本地能走、服务端拒绝"的分歧。
- **Canvas 性能**：只启动一条 `requestAnimationFrame` 循环，动态数据通过 ref 读取；静态地图底图缓存到离屏画布，地图滚出视口时暂停渲染；机器人有格间补间动画，并遵循 `prefers-reduced-motion`。
- **路径金币**：规划成功后路径格显示金币，机器人踩到即收集并播放短动画；起点格只标记隐藏不计数，面板显示“已收集 / 可收集”进度；手动移动若被服务端拒绝，会回滚这一步的乐观收集。
- **路径规划**：BFS 使用游标队列，A* 使用二叉最小堆开放列表；多段规划会对访问序列与路径连接点去重。

## 验收用例

`.spark/e2e-test/` 下保留了手动控制、速度、路径规划等验收描述，可据此做人工或自动化回归。
