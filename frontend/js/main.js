/** 主流程：状态加载、动作调用、巡检轮询与页面反馈。 */
(function () {
  let busy = false;
  let pollTimer = null;

  const $ = (selector) => document.querySelector(selector);

  function setBusy(value) {
    busy = value;
    const disabled = busy || View.getState() === null;
    document.querySelectorAll("[data-direction]").forEach((button) => {
      button.disabled = disabled;
    });
    $("#patrol-start").disabled = disabled;
    $("#patrol-stop").disabled = disabled;
    $("#return-home").disabled = disabled;
    $("#reset").disabled = disabled;
    $("#reload").disabled = disabled;
  }

  function showStatus(message, kind = "success") {
    const status = $("#status");
    status.textContent = message;
    status.dataset.kind = kind;
  }

  async function loadState() {
    if (busy) return;
    setBusy(true);
    showStatus("正在读取状态…", "pending");
    try {
      const state = await API.requestJSON("/api/state");
      View.render(state);
      showStatus("状态已读取，可以操作机器人。");
      schedulePoll();
    } catch (error) {
      showStatus(error.message, "error");
      if (View.getState() === null) {
        $("#map-placeholder").textContent = "地图加载失败，请重试加载。";
      }
    } finally {
      setBusy(false);
    }
  }

  async function move(direction) {
    if (busy || View.getState() === null) return;
    setBusy(true);
    showStatus("正在发送移动指令…", "pending");
    try {
      const state = await API.requestJSON("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      View.render(state);
      showStatus(`已移动至 (${state.robot.x}, ${state.robot.y})。`);
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function planTo(x, y) {
    if (busy || View.getState() === null) return;
    setBusy(true);
    try {
      const result = await API.requestJSON("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: { x, y } }),
      });
      if (result.ok) {
        View.setPlannedPath(result.path);
        View.render(View.getState());
        showStatus(`已规划到 (${x}, ${y}) 的路径，共 ${result.path.length} 格。`);
      } else {
        showStatus(result.reason || "无法规划路径。", "error");
      }
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function patrolStart() {
    if (busy) return;
    setBusy(true);
    showStatus("正在启动自动巡检…", "pending");
    try {
      const state = await API.requestJSON("/api/patrol/start", { method: "POST" });
      View.render(state);
      showStatus("自动巡检已启动，正在按顺序前往检查点。");
      schedulePoll();
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function patrolStop() {
    if (busy) return;
    setBusy(true);
    showStatus("正在停止巡检…", "pending");
    try {
      const state = await API.requestJSON("/api/patrol/stop", { method: "POST" });
      View.render(state);
      showStatus("巡检已停止。");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetSim() {
    if (busy) return;
    setBusy(true);
    showStatus("正在复位…", "pending");
    try {
      const state = await API.requestJSON("/api/reset", { method: "POST" });
      View.setPlannedPath([]);
      View.render(state);
      showStatus("机器人已复位到初始位置。");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function returnHome() {
    if (busy || View.getState() === null) return;
    setBusy(true);
    showStatus("正在返航…", "pending");
    try {
      const state = await API.requestJSON("/api/return-home", { method: "POST" });
      View.render(state);
      showStatus("已下发返航指令，机器人正在返回起点。");
      schedulePoll();
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleObstacle(x, y) {
    if (busy || View.getState() === null) return;
    setBusy(true);
    try {
      const state = await API.requestJSON("/api/map/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      });
      View.render(state);
      showStatus(`已切换 (${x}, ${y}) 的障碍状态。`);
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDynamic() {
    if (busy) return;
    const btn = $("#dynamic-mode");
    const next = btn.dataset.active !== "true";
    btn.dataset.active = String(next);
    btn.setAttribute("aria-pressed", String(next));
    btn.classList.toggle("active", next);
    try {
      await API.requestJSON("/api/map/dynamic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      showStatus(next ? "动态障碍已开启，障碍会随机移动。" : "动态障碍已关闭。");
    } catch (error) {
      showStatus(error.message, "error");
    }
  }

  function toggleEditMode() {
    const btn = $("#edit-mode");
    const next = btn.dataset.active !== "true";
    btn.dataset.active = String(next);
    btn.setAttribute("aria-pressed", String(next));
    btn.classList.toggle("active", next);
    showStatus(next ? "编辑模式：点击格子放置/移除障碍。" : "规划模式：点击空地查询路径。");
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(() => {
      if (View.getState()?.patrol?.active) {
        void pollTick();
      }
    }, 500);
  }

  async function pollTick() {
    if (busy) {
      schedulePoll();
      return;
    }
    try {
      const state = await API.requestJSON("/api/state");
      View.render(state);
      // 巡检结束（含返航到达起点）后用后端结果覆盖“正在前往检查点”的旧提示。
      if (state.patrol && !state.patrol.active && state.patrol.completed) {
        showStatus(state.patrol.message || "巡检完成。");
      }
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      schedulePoll();
    }
  }

  Control.bind({
    move,
    patrolStart,
    patrolStop,
    returnHome,
    reset: resetSim,
    reload: loadState,
    pickTarget: planTo,
    toggleObstacle,
    toggleEditMode,
    toggleDynamic,
  });

  loadState();
})();
