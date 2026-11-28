/** 交互绑定：按钮、键盘、地图选点。具体动作由 main.js 注入。 */
const Control = (() => {
  const KEY_MAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
  };

  function bind(handlers) {
    document.querySelectorAll("[data-direction]").forEach((button) => {
      button.addEventListener("click", () => handlers.move(button.dataset.direction));
    });
    document.querySelector("#patrol-start").addEventListener("click", handlers.patrolStart);
    document.querySelector("#patrol-stop").addEventListener("click", handlers.patrolStop);
    document.querySelector("#return-home").addEventListener("click", handlers.returnHome);
    document.querySelector("#reset").addEventListener("click", handlers.reset);
    document.querySelector("#reload").addEventListener("click", handlers.reload);
    document.querySelector("#edit-mode").addEventListener("click", handlers.toggleEditMode);
    document.querySelector("#dynamic-mode").addEventListener("click", handlers.toggleDynamic);

    document.querySelector("#map").addEventListener("click", (event) => {
      const cell = event.target.closest(".cell");
      if (!cell) return;
      const x = Number(cell.dataset.x);
      const y = Number(cell.dataset.y);
      const editActive = document.querySelector("#edit-mode").dataset.active === "true";
      if (editActive) handlers.toggleObstacle(x, y);
      else handlers.pickTarget(x, y);
    });

    document.addEventListener("keydown", (event) => {
      const direction = KEY_MAP[event.key];
      if (direction) {
        event.preventDefault();
        handlers.move(direction);
      }
    });
  }

  return { bind };
})();
