/** 页面绘制：地图、机器人、检查点、规划路径与状态面板。页面只按后端响应绘制，不本地预测移动结果。 */
const View = (() => {
  let currentState = null;
  let plannedPath = [];

  const DIRECTION_ARROWS = { up: "▲", down: "▼", left: "◀", right: "▶" };
  const STATUS_LABELS = {
    idle: "空闲",
    moving: "巡检行进中",
    blocked: "移动受阻",
    error: "异常停止",
  };

  function validateState(state) {
    const isPoint = (p) => Number.isInteger(p?.x) && Number.isInteger(p?.y);
    if (
      !state ||
      !Number.isInteger(state.map?.width) || state.map.width < 1 ||
      !Number.isInteger(state.map?.height) || state.map.height < 1 ||
      !Array.isArray(state.map.obstacles) || !state.map.obstacles.every(isPoint) ||
      !Array.isArray(state.map.checkpoints) || !state.map.checkpoints.every(isPoint) ||
      !Array.isArray(state.patrol?.visited) || !state.patrol.visited.every(isPoint) ||
      typeof state.patrol.completed !== "boolean" ||
      !isPoint(state.robot)
    ) {
      throw new Error("服务返回的状态格式有误，请重新读取状态。");
    }
  }

  function render(state) {
    validateState(state);
    currentState = state;

    document.querySelector("#map-size").textContent = `${state.map.width} × ${state.map.height}`;
    document.querySelector("#coordinates").textContent = `(${state.robot.x}, ${state.robot.y})`;
    document.querySelector("#direction").textContent =
      `${state.robot.dirLabel} ${DIRECTION_ARROWS[state.robot.dir] || ""}`;
    document.querySelector("#robot-status").textContent =
      STATUS_LABELS[state.robot.status] || state.robot.status;

    const sensor = state.sensor;
    if (sensor.blocked && sensor.hit === "obstacle") {
      document.querySelector("#sensor-reading").textContent = `前方有障碍物（可通行 ${sensor.distance} 格后受阻）`;
    } else if (sensor.blocked && sensor.hit === "boundary") {
      document.querySelector("#sensor-reading").textContent = `前方到达地图边界（可通行 ${sensor.distance} 格）`;
    } else {
      document.querySelector("#sensor-reading").textContent = `前方通畅（可通行 ${sensor.distance} 格）`;
    }

    const stats = state.stats || {};
    document.querySelector("#stat-steps").textContent = stats.steps ?? 0;
    document.querySelector("#stat-path").textContent = stats.pathLength ?? 0;
    document.querySelector("#stat-elapsed").textContent = `${Number(stats.elapsed || 0).toFixed(1)}s`;
    document.querySelector("#stat-coverage").textContent = `${Math.round(Number(stats.coverage || 0) * 100)}%`;

    const progress = document.querySelector("#patrol-progress");
    if (state.patrol.completed) {
      progress.textContent = `巡检完成：${state.map.checkpoints.length} 个检查点全部经过。`;
    } else if (state.patrol.active) {
      progress.textContent = `巡检中：已到达 ${state.patrol.visited.length} / ${state.map.checkpoints.length} 个检查点。`;
    } else {
      progress.textContent = `已经过 ${state.patrol.visited.length} / ${state.map.checkpoints.length} 个检查点`;
    }
    progress.dataset.complete = String(state.patrol.completed);

    drawGrid(state);

    document.querySelector("#map-placeholder").hidden = true;
    document.querySelector("#map-board").hidden = false;
  }

  function drawGrid(state) {
    const { width, height, obstacles, checkpoints } = state.map;
    const map = document.querySelector("#map");
    map.style.setProperty("--columns", width);
    map.replaceChildren();

    const obstacleSet = new Set(obstacles.map((p) => `${p.x},${p.y}`));
    const visitedSet = new Set(state.patrol.visited.map((p) => `${p.x},${p.y}`));
    const pathSet = new Set(plannedPath.map((p) => `${p.x},${p.y}`));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.setAttribute("role", "gridcell");

        if (obstacleSet.has(`${x},${y}`)) {
          cell.classList.add("obstacle");
          cell.textContent = "障";
        } else {
          cell.classList.add("passable");
        }
        const checkpointIndex = checkpoints.findIndex((p) => p.x === x && p.y === y);
        if (checkpointIndex !== -1) {
          cell.classList.add("checkpoint");
          if (visitedSet.has(`${x},${y}`)) cell.classList.add("visited");
          cell.textContent = visitedSet.has(`${x},${y}`) ? "已" : `点${checkpointIndex + 1}`;
        }
        if (pathSet.has(`${x},${y}`) && !obstacleSet.has(`${x},${y}`)) {
          cell.classList.add("path");
        }
        if (state.robot.x === x && state.robot.y === y) {
          cell.classList.add("robot-marker");
          const arrow = document.createElement("span");
          arrow.className = "robot-arrow";
          arrow.textContent = DIRECTION_ARROWS[state.robot.dir] || "机";
          cell.replaceChildren(arrow);
        }
        map.append(cell);
      }
    }
  }

  function getState() { return currentState; }
  function setPlannedPath(path) { plannedPath = path || []; }

  return { render, getState, setPlannedPath, validateState };
})();
