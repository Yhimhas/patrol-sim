import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { AlertTriangle, Bot, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { getMap, getRobotState, moveRobot, resetRobot, planPath } from '@client/src/api/index';
import { MAX_CHECKPOINTS } from '@shared/api.interface';
import type {
  PathAlgorithm,
  Point,
  RobotDirection,
  RobotState,
} from '@shared/api.interface';
import {
  directionsForPath,
  evaluateMove,
  manhattan,
  MOVE_BLOCK_MESSAGES,
  samePoint,
} from '@shared/grid';
import MapCanvas from './MapCanvas';
import StatusPanel from './StatusPanel';
import ControlPanel from './ControlPanel';
import PathPanel from './PathPanel';
import type { WalkSpeed } from './PathPanel';
import { useCoinCollection } from './useCoinCollection';

const WALK_INTERVAL_MS = 120;
const SEARCH_ANIMATION_MS = 800;
const SEARCH_FRAME_MS = 40;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** 马里奥场景背景：云朵与底部草地，纯装饰。 */
function SceneCloud({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`sim-cloud-drift absolute ${className}`} style={style}>
      <div className="absolute bottom-0 left-0 h-[55%] w-full rounded-full bg-white/80" />
      <div className="absolute left-[10%] top-[6%] h-[82%] w-[48%] rounded-full bg-white/80" />
      <div className="absolute right-[8%] top-[22%] h-[64%] w-[42%] rounded-full bg-white/80" />
    </div>
  );
}

function SceneBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <SceneCloud
        className="left-[4%] top-[8%] h-10 w-32"
        style={{ animationDuration: '34s' }}
      />
      <SceneCloud
        className="left-[9%] top-[4%] h-14 w-24 opacity-80"
        style={{ animationDuration: '42s', animationDelay: '-6s' }}
      />
      <SceneCloud
        className="right-[6%] top-[17%] h-9 w-28 opacity-90"
        style={{ animationDuration: '38s', animationDelay: '-14s' }}
      />
      <SceneCloud
        className="right-[13%] top-[12%] h-12 w-20 opacity-80"
        style={{ animationDuration: '46s', animationDelay: '-3s' }}
      />
      <SceneCloud
        className="right-[38%] top-[6%] h-8 w-20 opacity-60"
        style={{ animationDuration: '40s', animationDelay: '-20s' }}
      />

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#4caf50]/80 via-[#98d46e]/30 to-transparent" />
      <div className="absolute -bottom-8 left-[6%] h-20 w-40 rounded-t-full bg-[#2e7d32]/50" />
      <div className="absolute -bottom-10 right-[10%] h-24 w-52 rounded-t-full bg-[#4caf50]/45" />
      <div className="absolute -bottom-6 left-[28%] h-14 w-24 rounded-t-full bg-[#6db33f]/40" />
    </div>
  );
}

const PatrolSimulatorPage = () => {
  const queryClient = useQueryClient();

  const [algorithm, setAlgorithm] = useState<PathAlgorithm>('bfs');
  const [walkSpeed, setWalkSpeed] = useState<WalkSpeed>(1);
  const [plannedAlgorithm, setPlannedAlgorithm] = useState<
    PathAlgorithm | undefined
  >(undefined);
  const [visitedCells, setVisitedCells] = useState<Point[]>([]);
  const [pathCells, setPathCells] = useState<Point[]>([]);
  const [checkpointCells, setCheckpointCells] = useState<Point[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [pathLength, setPathLength] = useState<number | undefined>(undefined);
  const [visitedCount, setVisitedCount] = useState<number | undefined>(undefined);
  const [planError, setPlanError] = useState<string | undefined>(undefined);
  const [localRobot, setLocalRobot] = useState<RobotState | null>(null);

  const {
    collectedCoins,
    eatenCoinKeys,
    coinBursts,
    totalCoins,
    collectCoinAt,
    markCoinEaten,
    rollbackCoin,
    resetCoinCollection,
  } = useCoinCollection(pathCells);

  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localRobotRef = useRef<RobotState | null>(null);
  const walkTokenRef = useRef(0);
  const pendingMovesRef = useRef(0);
  const moveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastServerRobotRef = useRef<RobotState | null>(null);

  const {
    data: mapData,
    isLoading: mapLoading,
    isError: mapError,
    refetch: refetchMap,
  } = useQuery({
    queryKey: ['map'],
    queryFn: getMap,
  });

  const {
    data: robotState,
    isLoading: robotLoading,
    isError: robotError,
    refetch: refetchRobot,
  } = useQuery({
    queryKey: ['robot'],
    queryFn: getRobotState,
  });

  useEffect(() => {
    if (robotState && !localRobotRef.current) {
      localRobotRef.current = robotState;
      lastServerRobotRef.current = robotState;
      setLocalRobot(robotState);
    }
  }, [robotState]);

  const clearPlanView = useCallback(() => {
    setVisitedCells([]);
    setPathCells([]);
    setPathLength(undefined);
    setVisitedCount(undefined);
    setPlanError(undefined);
    setPlannedAlgorithm(undefined);
    resetCoinCollection();
  }, [resetCoinCollection]);

  const syncRobot = useCallback(async (): Promise<RobotState | null> => {
    try {
      const data = await getRobotState();
      localRobotRef.current = data;
      lastServerRobotRef.current = data;
      setLocalRobot(data);
      queryClient.setQueryData(['robot'], data);
      return data;
    } catch (error) {
      logger.error('同步机器人状态失败', error);
      return null;
    }
  }, [queryClient]);

  /**
   * 所有手动移动请求串行发出，保证服务端处理顺序与本地乐观更新一致。
   * 队列清空后再用服务端状态校准本地，任一请求失败都不会留下错位状态。
   */
  const reconcileMoveQueue = useCallback(async () => {
    if (pendingMovesRef.current > 0) return;

    const server = lastServerRobotRef.current;
    if (!server) {
      await syncRobot();
      return;
    }
    if (pendingMovesRef.current > 0) return;

    localRobotRef.current = server;
    setLocalRobot(server);
  }, [syncRobot]);
  const enqueueMove = useCallback(
    (direction: RobotDirection, collectedCoinKey?: string) => {
      pendingMovesRef.current += 1;

      const run = moveQueueRef.current.then(async () => {
        try {
          const response = await moveRobot(direction);
          lastServerRobotRef.current = response.robot;
          queryClient.setQueryData(['robot'], response.robot);
          if (!response.success) {
            // 服务端拒绝时撤销本地乐观吃到的金币
            if (collectedCoinKey) rollbackCoin(collectedCoinKey);
            toast.error(response.message, { id: 'move-server-error' });
          }
        } catch (error) {
          logger.error('移动同步失败', error);
          lastServerRobotRef.current = null;
          toast.error('移动同步失败，正在重新校准…', {
            id: 'move-server-error',
          });
        } finally {
          pendingMovesRef.current = Math.max(0, pendingMovesRef.current - 1);
          if (pendingMovesRef.current === 0) {
            void reconcileMoveQueue();
          }
        }
      });

      moveQueueRef.current = run.catch(() => undefined);
    },
    [queryClient, reconcileMoveQueue, rollbackCoin],
  );

  const applyLocalMove = useCallback(
    (
      direction: RobotDirection,
    ): { allowed: boolean; collectedCoinKey?: string } => {
      const current = localRobotRef.current;
      if (!mapData || !current) return { allowed: false };

      const evaluation = evaluateMove(mapData, current, direction);
      if (!evaluation.allowed) {
        toast.error(MOVE_BLOCK_MESSAGES[evaluation.reason ?? 'obstacle'], {
          id: 'move-blocked',
        });
        return { allowed: false };
      }

      const nextState: RobotState = {
        ...current,
        x: evaluation.next.x,
        y: evaluation.next.y,
        direction,
        battery: Math.max(0, current.battery - 1),
        steps: current.steps + 1,
        manhattanDistance: manhattan(evaluation.next, mapData.target),
      };

      localRobotRef.current = nextState;
      setLocalRobot(nextState);
      const collectedCoinKey = collectCoinAt(nextState);

      if (samePoint(nextState, mapData.target)) {
        toast.success('已到达终点！', { id: 'arrival' });
      }

      return {
        allowed: true,
        collectedCoinKey: collectedCoinKey ?? undefined,
      };
    },
    [mapData, collectCoinAt],
  );

  const handleMove = useCallback(
    (direction: RobotDirection) => {
      if (isPlanning || isWalking) return;
      const result = applyLocalMove(direction);
      if (!result.allowed) return;
      void enqueueMove(direction, result.collectedCoinKey);
    },
    [isPlanning, isWalking, applyLocalMove, enqueueMove],
  );

  const resetMutation = useMutation({
    mutationFn: resetRobot,
    retry: false,
    onSuccess: (data: RobotState) => {
      walkTokenRef.current += 1;
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      localRobotRef.current = data;
      lastServerRobotRef.current = data;
      setLocalRobot(data);
      queryClient.setQueryData(['robot'], data);
      clearPlanView();
      setCheckpointCells([]);
      setIsPlanning(false);
      setIsWalking(false);
      toast.success('已重置到起点', { id: 'reset' });
    },
    onError: (error: unknown) => {
      logger.error('重置失败', error);
      toast.error('重置失败，正在同步状态…', { id: 'reset' });
      void syncRobot();
    },
  });

  const handlePlan = useCallback(async () => {
    const robot = localRobotRef.current;
    if (!mapData || !robot || isPlanning || isWalking) return;

    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    resetCoinCollection();
    setVisitedCells([]);
    setPathCells([]);
    setPathLength(undefined);
    setVisitedCount(undefined);
    setPlanError(undefined);
    setPlannedAlgorithm(undefined);
    setIsPlanning(true);

    const usedAlgorithm = algorithm;

    try {
      const data = await planPath({
        algorithm: usedAlgorithm,
        start: { x: robot.x, y: robot.y },
        end: { x: mapData.target.x, y: mapData.target.y },
        checkpoints: checkpointCells,
      });

      if (!data.success) {
        setPlanError(data.message || '规划失败');
        setIsPlanning(false);
        toast.error(data.message || '路径规划失败', { id: 'plan-error' });
        return;
      }

      setPlannedAlgorithm(usedAlgorithm);

      const {
        visitedOrder,
        path,
        pathLength: length,
        visitedCount: count,
      } = data;

      if (length === 0) {
        setVisitedCells(path.slice(0, 1));
        setPathCells(path.slice(0, 1));
        if (path[0]) markCoinEaten(path[0]);
        setPathLength(0);
        setVisitedCount(1);
        setIsPlanning(false);
        toast.info('机器人已在终点位置', { id: 'plan-info' });
        return;
      }

      if (visitedOrder.length === 0) {
        setPathCells(path);
        if (path[0]) markCoinEaten(path[0]);
        setPathLength(length);
        setVisitedCount(count);
        setIsPlanning(false);
        return;
      }

      const totalFrames = Math.max(
        1,
        Math.floor(SEARCH_ANIMATION_MS / SEARCH_FRAME_MS),
      );
      const batchSize = Math.max(
        1,
        Math.ceil(visitedOrder.length / totalFrames),
      );
      let index = 0;

      const step = () => {
        const end = Math.min(index + batchSize, visitedOrder.length);
        const batch = visitedOrder.slice(index, end);
        setVisitedCells((previous: Point[]) => [...previous, ...batch]);
        index = end;

        if (index < visitedOrder.length) {
          animationTimerRef.current = setTimeout(step, SEARCH_FRAME_MS);
        } else {
          setPathCells(path);
          if (path[0]) markCoinEaten(path[0]);
          setPathLength(length);
          setVisitedCount(count);
          setIsPlanning(false);
          animationTimerRef.current = null;
        }
      };

      animationTimerRef.current = setTimeout(step, SEARCH_FRAME_MS);
    } catch (error) {
      logger.error('路径规划失败', error);
      setPlanError('路径规划请求失败');
      setIsPlanning(false);
      toast.error('路径规划请求失败', { id: 'plan-error' });
    }
  }, [
    algorithm,
    checkpointCells,
    isPlanning,
    isWalking,
    mapData,
    markCoinEaten,
    resetCoinCollection,
  ]);

  /**
   * 自动巡检：每一步都等待服务端移动成功后再继续，
   * 服务端始终是机器人的唯一权威状态，刷新页面也不会回退。
   */
  const handleAutoWalk = useCallback(async () => {
    const robot = localRobotRef.current;
    if (!robot || pathCells.length === 0 || isWalking || isPlanning) return;

    const startIndex = pathCells.findIndex((point) => samePoint(point, robot));
    if (startIndex < 0) {
      toast.error('机器人不在已规划路径上，请重新规划', {
        id: 'walk-error',
      });
      return;
    }

    const directions = directionsForPath(pathCells, startIndex);
    if (!directions) {
      toast.error('路径数据异常，请重新规划', { id: 'walk-error' });
      return;
    }
    if (directions.length === 0) {
      toast.info('机器人已在路径终点', { id: 'walk-info' });
      return;
    }

    const token = walkTokenRef.current + 1;
    walkTokenRef.current = token;
    setIsWalking(true);

    const interval = Math.max(40, Math.round(WALK_INTERVAL_MS / walkSpeed));

    try {
      // 先等待手动移动队列清空，避免与服务端状态竞争
      await moveQueueRef.current.catch(() => undefined);
      if (walkTokenRef.current !== token) return;

      for (const direction of directions) {
        if (walkTokenRef.current !== token) return;

        const response = await moveRobot(direction);
        if (walkTokenRef.current !== token) return;

        localRobotRef.current = response.robot;
        lastServerRobotRef.current = response.robot;
        setLocalRobot(response.robot);
        queryClient.setQueryData(['robot'], response.robot);

        if (!response.success) {
          toast.error(response.message, { id: 'walk-error' });
          return;
        }

        collectCoinAt(response.robot);

        await sleep(interval);
      }

      if (walkTokenRef.current === token) {
        toast.success(`巡检完成：共行走 ${directions.length} 步`, {
          id: 'walk-done',
        });
      }
    } catch (error) {
      logger.error('自动巡检失败', error);
      toast.error('自动巡检中断，正在同步状态…', { id: 'walk-error' });
      await syncRobot();
    } finally {
      if (walkTokenRef.current === token) {
        setIsWalking(false);
      }
    }
  }, [isWalking, isPlanning, pathCells, queryClient, syncRobot, walkSpeed, collectCoinAt]);

  const handleCellClick = useCallback(
    (point: Point) => {
      if (isPlanning || isWalking) return;

      const exists = checkpointCells.some((item) => samePoint(item, point));
      if (exists) {
        setCheckpointCells((previous: Point[]) =>
          previous.filter((item) => !samePoint(item, point)),
        );
      } else if (checkpointCells.length >= MAX_CHECKPOINTS) {
        toast.info(`最多设置 ${MAX_CHECKPOINTS} 个检查点，已替换最早的检查点`, {
          id: 'checkpoint-limit',
        });
        setCheckpointCells((previous: Point[]) => [
          ...previous.slice(1),
          point,
        ]);
      } else {
        setCheckpointCells((previous: Point[]) => [...previous, point]);
      }

      clearPlanView();
    },
    [checkpointCells, isPlanning, isWalking, clearPlanView],
  );

  const handleRemoveCheckpoint = useCallback(
    (point: Point) => {
      setCheckpointCells((previous: Point[]) =>
        previous.filter((item) => !samePoint(item, point)),
      );
      clearPlanView();
    },
    [clearPlanView],
  );

  const handleClearCheckpoints = useCallback(() => {
    setCheckpointCells([]);
    clearPlanView();
  }, [clearPlanView]);

  // 键盘控制：方向键 / WASD；输入框聚焦时不拦截
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPlanning || isWalking) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key.toLowerCase();
      let direction: RobotDirection | null = null;

      if (key === 'arrowup' || key === 'w') direction = 'up';
      else if (key === 'arrowdown' || key === 's') direction = 'down';
      else if (key === 'arrowleft' || key === 'a') direction = 'left';
      else if (key === 'arrowright' || key === 'd') direction = 'right';

      if (direction) {
        event.preventDefault();
        handleMove(direction);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, isPlanning, isWalking]);

  // 卸载时终止搜索动画与自动巡检令牌；金币计时器由 useCoinCollection 清理
  useEffect(() => {
    return () => {
      walkTokenRef.current += 1;
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const isLoading = mapLoading || robotLoading;
  const hasError = mapError || robotError;
  const displayRobot = localRobot ?? robotState ?? null;
  const arrived =
    !!displayRobot &&
    !!mapData &&
    samePoint(displayRobot, mapData.target);
  const canWalk =
    pathCells.length > 1 && !isWalking && !isPlanning;
  const isResetting = resetMutation.isPending;

  const handleReset = useCallback(async () => {
    // 等待在途移动请求落地，避免重置后被迟到的移动请求覆盖
    await moveQueueRef.current.catch(() => undefined);
    resetMutation.mutate();
  }, [resetMutation]);

  // 稳定的包装回调，让 memo 化的面板在巡检过程中不必跟着金币计数重渲染
  const handleResetClick = useCallback(() => {
    void handleReset();
  }, [handleReset]);
  const handlePlanClick = useCallback(() => {
    void handlePlan();
  }, [handlePlan]);
  const handleAutoWalkClick = useCallback(() => {
    void handleAutoWalk();
  }, [handleAutoWalk]);

  const handleRetry = () => {
    if (mapError) void refetchMap();
    if (robotError) void refetchRobot();
  };

  const statusView = isPlanning
    ? {
        label: '路径规划中',
        className:
          'border-[#e8871a] bg-[#fff7ed] text-[#b45309] shadow-[0_2px_0_rgba(154,52,18,0.3)]',
        dot: 'bg-[#f59e0b] animate-pulse',
      }
    : isWalking
      ? {
          label: '自动巡检中',
          className:
            'border-[#0065bd] bg-[#eff6ff] text-[#1d4ed8] shadow-[0_2px_0_rgba(30,58,138,0.3)]',
          dot: 'bg-[#3b82f6] animate-pulse',
        }
      : arrived
        ? {
            label: '已到达终点',
            className:
              'border-[#16a34a] bg-[#f0fdf4] text-[#15803d] shadow-[0_2px_0_rgba(22,101,52,0.3)]',
            dot: 'bg-[#22c55e]',
          }
        : {
            label: '待机中',
            className:
              'border-[#8b5a2b] bg-[#fffbeb] text-[#78350f] shadow-[0_2px_0_rgba(107,66,32,0.3)]',
            dot: 'bg-[#a16207]',
          };

  if (hasError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#5c94fc] via-[#7ec0ee] to-[#a8e063] p-6">
        <SceneBackdrop />
        <div className="relative w-full max-w-md rounded-2xl border-2 border-[#e11d48] bg-[#fffdf7] p-6 text-center shadow-[0_5px_0_#9f1239]">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-[#e52521]" />
          <h2 className="text-base font-extrabold text-[#7c2d12]">加载失败</h2>
          <p className="mt-2 text-sm text-[#9a6a33]">
            无法获取地图或机器人状态，请检查网络后重试。
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-[#1e3a8a] bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] px-4 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_#1e3a8a] transition-all duration-100 hover:from-[#60a5fa] hover:to-[#2563eb] active:translate-y-0.5 active:shadow-[0_1px_0_#1e3a8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] focus-visible:ring-offset-2"
          >
            <RefreshCw size={15} />
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !mapData || !displayRobot) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#5c94fc] via-[#7ec0ee] to-[#a8e063] p-4 sm:p-6">
        <SceneBackdrop />
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl border-2 border-[#8b5a2b]/30 bg-[#fffdf7]" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40 bg-[#fffdf7]" />
              <Skeleton className="h-3 w-64 bg-[#fffdf7]/80" />
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row">
            <Skeleton className="h-[420px] flex-1 rounded-2xl border-2 border-[#8b5a2b]/30 bg-[#fffbeb]" />
            <div className="w-full space-y-4 lg:w-[300px]">
              <Skeleton className="h-56 rounded-2xl border-2 border-[#e8871a]/30 bg-[#fffdf7]" />
              <Skeleton className="h-56 rounded-2xl border-2 border-[#0065bd]/30 bg-[#fffdf7]" />
              <Skeleton className="h-72 rounded-2xl border-2 border-[#16a34a]/30 bg-[#fffdf7]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#5c94fc] via-[#7ec0ee] to-[#a8e063] text-[#1e293b]">
      <SceneBackdrop />
      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:h-screen lg:min-h-0">
        <header className="sim-rise flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="sim-float flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#a11814] bg-gradient-to-b from-[#ef4444] to-[#e52521] shadow-[0_3px_0_#7f120f]">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-wide text-white [text-shadow:2px_2px_0_#7c2d12]">
                智能巡检机器人
              </h1>
              <p className="text-xs font-semibold text-white [text-shadow:1px_1px_2px_rgba(60,30,10,0.55)]">
                二维仿真 · {mapData.width} × {mapData.height} 网格 · BFS / A*
                路径规划
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-xs font-bold ${statusView.className}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusView.dot}`} />
            {statusView.label}
          </span>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <section
            className="sim-rise relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border-2 border-[#8fb06a]/70 bg-[#fffbeb]/80 shadow-[0_6px_18px_rgba(60,40,10,0.22)] lg:min-h-0"
            style={{ animationDelay: '40ms' }}
          >
            <MapCanvas
              map={mapData}
              robot={displayRobot}
              visitedCells={visitedCells}
              pathCells={pathCells}
              checkpointCells={checkpointCells}
              eatenCoinKeys={eatenCoinKeys}
              coinBursts={coinBursts}
              onCellClick={handleCellClick}
              clickable={!isPlanning && !isWalking}
            />

            {arrived && !isPlanning && !isWalking && (
              <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-xl border-2 border-[#16a34a] bg-[rgba(255,253,247,0.95)] px-2.5 py-1.5 text-xs font-bold text-[#15803d] shadow-[0_2px_0_#15803d] backdrop-blur-sm">
                <CheckCircle2 size={14} />
                已到达终点
              </div>
            )}
          </section>

          <aside className="sim-scroll flex w-full shrink-0 flex-col gap-4 lg:w-[300px] lg:overflow-y-auto lg:pr-1">
            <StatusPanel
              robot={displayRobot}
              collectedCoins={collectedCoins}
              totalCoins={totalCoins}
            />
            <ControlPanel
              onMove={handleMove}
              onReset={handleResetClick}
              disabled={isResetting || isPlanning || isWalking}
            />
            <PathPanel
              algorithm={algorithm}
              onAlgorithmChange={setAlgorithm}
              onPlan={handlePlanClick}
              onAutoWalk={handleAutoWalkClick}
              isPlanning={isPlanning}
              isWalking={isWalking}
              canWalk={canWalk}
              pathLength={pathLength}
              visitedCount={visitedCount}
              plannedAlgorithm={plannedAlgorithm}
              errorMessage={planError}
              checkpoints={checkpointCells}
              onRemoveCheckpoint={handleRemoveCheckpoint}
              onClearCheckpoints={handleClearCheckpoints}
              walkSpeed={walkSpeed}
              onWalkSpeedChange={setWalkSpeed}
            />
          </aside>
        </main>
      </div>
    </div>
  );
};

export default PatrolSimulatorPage;
