require('reflect-metadata');

const assert = require('node:assert/strict');
const { RobotService } = require('../dist/server/modules/robot/robot.service.js');
const { PathService } = require('../dist/server/modules/path/path.service.js');
const { PlanDto } = require('../dist/server/modules/path/dto/plan.dto.js');
const { MoveDto } = require('../dist/server/modules/robot/dto/move.dto.js');
const { isWalkable, directionBetween } = require('../dist/shared/grid.js');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');

function assertPath(map, start, end, path, checkpoints = []) {
  assert.ok(path.length > 0, 'path should not be empty');
  assert.deepEqual(path[0], start, 'path must start at start');
  assert.deepEqual(path[path.length - 1], end, 'path must end at end');

  for (let i = 1; i < path.length; i += 1) {
    assert.ok(directionBetween(path[i - 1], path[i]), 'path must be contiguous');
    assert.ok(isWalkable(map, path[i].x, path[i].y), 'path must not hit obstacles');
  }

  let cursor = 0;
  for (const checkpoint of checkpoints) {
    const index = path.findIndex(
      (point, i) =>
        i >= cursor && point.x === checkpoint.x && point.y === checkpoint.y,
    );
    assert.ok(index >= cursor, 'checkpoint must be visited in order');
    cursor = index;
  }
}

async function errorsFor(payload) {
  const dto = plainToInstance(PlanDto, payload);
  return validate(dto);
}

(async () => {
  const robot = new RobotService();
  const pathService = new PathService(robot);
  const map = robot.getMap();

  assert.equal(map.width, 15);
  assert.equal(map.height, 10);

  let state = robot.getRobotState();
  assert.deepEqual(
    [state.x, state.y, state.battery, state.steps],
    [1, 1, 100, 0],
  );

  let response = robot.move('right');
  assert.equal(response.success, true);
  assert.equal(response.robot.x, 2);
  assert.equal(response.robot.battery, 99);
  assert.equal(response.robot.steps, 1);

  robot.move('up');
  response = robot.move('up');
  assert.equal(response.success, false);
  assert.equal(response.message, '超出地图边界');

  robot.reset();
  robot.move('right');
  robot.move('down');
  response = robot.move('right');
  assert.equal(response.success, false);
  assert.equal(response.message, '前方是障碍物');

  robot.reset();
  for (let i = 0; i < 50; i += 1) {
    robot.move('right');
    robot.move('left');
  }
  assert.equal(robot.getRobotState().battery, 0);
  response = robot.move('right');
  assert.equal(response.success, false);
  assert.equal(response.message, '电量不足，请重置后再继续');

  state = robot.reset();
  assert.deepEqual(
    [state.x, state.y, state.battery, state.steps],
    [1, 1, 100, 0],
  );

  const start = { x: 1, y: 1 };
  const end = { ...map.target };

  const bfs = pathService.plan({ algorithm: 'bfs', start, end });
  assert.equal(bfs.success, true);
  assertPath(map, start, end, bfs.path);
  assert.equal(bfs.pathLength, bfs.path.length - 1);
  assert.equal(bfs.visitedCount, bfs.visitedOrder.length);

  const astar = pathService.plan({ algorithm: 'astar', start, end });
  assert.equal(astar.success, true);
  assertPath(map, start, end, astar.path);
  assert.equal(astar.pathLength, bfs.pathLength, 'A* should be optimal');

  const checkpoints = [
    { x: 7, y: 3 },
    { x: 11, y: 5 },
  ];
  const viaCheckpoints = pathService.plan({
    algorithm: 'astar',
    start,
    end,
    checkpoints,
  });
  assert.equal(viaCheckpoints.success, true);
  assertPath(map, start, end, viaCheckpoints.path, checkpoints);
  assert.ok(
    viaCheckpoints.pathLength >= astar.pathLength,
    'checkpoint route cannot be shorter than direct route',
  );

  const duplicateCheckpoint = pathService.plan({
    algorithm: 'bfs',
    start,
    end,
    checkpoints: [start, end],
  });
  assert.equal(duplicateCheckpoint.success, true);
  assert.equal(duplicateCheckpoint.pathLength, bfs.pathLength);

  const obstacleCheckpoint = pathService.plan({
    algorithm: 'bfs',
    start,
    end,
    checkpoints: [{ x: 3, y: 2 }],
  });
  assert.equal(obstacleCheckpoint.success, false);
  assert.match(obstacleCheckpoint.message, /检查点/);

  const same = pathService.plan({
    algorithm: 'bfs',
    start: { x: 5, y: 1 },
    end: { x: 5, y: 1 },
  });
  assert.equal(same.success, true);
  assert.equal(same.pathLength, 0);
  assert.equal(same.path.length, 1);

  const invalidStart = pathService.plan({
    algorithm: 'bfs',
    start: { x: 3, y: 2 },
    end,
  });
  assert.equal(invalidStart.success, false);
  assert.match(invalidStart.message, /起点/);

  assert.equal(
    (
      await errorsFor({
        algorithm: 'astar',
        start,
        end,
        checkpoints: [{ x: 5, y: 5 }],
      })
    ).length,
    0,
  );
  assert.ok((await errorsFor({ algorithm: 'bfs', end })).length > 0);
  assert.ok(
    (
      await errorsFor({
        algorithm: 'bfs',
        start: { x: 'a', y: 1 },
        end,
      })
    ).length > 0,
  );
  assert.ok(
    (
      await errorsFor({
        algorithm: 'bfs',
        start,
        end,
        checkpoints: [
          { x: 2, y: 1 },
          { x: 3, y: 1 },
          { x: 4, y: 1 },
        ],
      })
    ).length > 0,
  );
  assert.ok(
    (
      await errorsFor({
        algorithm: 'dijkstra',
        start,
        end,
      })
    ).length > 0,
  );

  assert.equal(
    (await validate(plainToInstance(MoveDto, { direction: 'up' }))).length,
    0,
  );
  assert.ok(
    (
      await validate(plainToInstance(MoveDto, { direction: 'diagonal' }))
    ).length > 0,
  );

  console.log('SMOKE_OK');
  console.log(
    JSON.stringify({
      bfs: { length: bfs.pathLength, visited: bfs.visitedCount },
      astar: { length: astar.pathLength, visited: astar.visitedCount },
      checkpoints: {
        length: viaCheckpoints.pathLength,
        visited: viaCheckpoints.visitedCount,
      },
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
