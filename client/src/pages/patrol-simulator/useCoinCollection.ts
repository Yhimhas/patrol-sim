import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Point } from '@shared/api.interface';
import { samePoint } from '@shared/grid';
import {
  COIN_BURST_CLEANUP_MS,
  COIN_BURST_DELAY_MS,
  coinKey,
} from './coins';
import type { CoinBurst } from './coins';

interface CoinCollection {
  collectedCoins: number;
  eatenCoinKeys: ReadonlySet<string>;
  coinBursts: CoinBurst[];
  /** 路径上除起点外的金币数量，用作面板上的 X / Y 进度。 */
  totalCoins: number;
  /**
   * 收集指定格子的金币；返回新吃掉的 coin key。
   * 该 key 可用于服务端拒绝移动时回滚乐观收集。
   */
  collectCoinAt: (point: Point) => string | null;
  /** 仅标记为已吃，不计数、不播放动画（用于规划后机器人脚下的起点格）。 */
  markCoinEaten: (point: Point) => void;
  rollbackCoin: (key: string) => void;
  resetCoinCollection: () => void;
}

export function useCoinCollection(pathCells: Point[]): CoinCollection {
  const pathCellsRef = useRef<Point[]>(pathCells);
  const eatenCoinKeysRef = useRef<Set<string>>(new Set());
  const burstTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const [collectedCoins, setCollectedCoins] = useState(0);
  const [eatenCoinKeys, setEatenCoinKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [coinBursts, setCoinBursts] = useState<CoinBurst[]>([]);

  useEffect(() => {
    pathCellsRef.current = pathCells;
  }, [pathCells]);

  const addEatenKey = useCallback((point: Point): string | null => {
    const key = coinKey(point);
    if (eatenCoinKeysRef.current.has(key)) return null;

    eatenCoinKeysRef.current.add(key);
    setEatenCoinKeys(new Set(eatenCoinKeysRef.current));
    return key;
  }, []);

  const clearBursts = useCallback(() => {
    for (const timer of burstTimersRef.current.values()) {
      clearTimeout(timer);
    }
    burstTimersRef.current.clear();
    setCoinBursts([]);
  }, []);

  const resetCoinCollection = useCallback(() => {
    eatenCoinKeysRef.current.clear();
    setEatenCoinKeys(new Set());
    setCollectedCoins(0);
    clearBursts();
  }, [clearBursts]);

  const collectCoinAt = useCallback(
    (point: Point): string | null => {
      if (!pathCellsRef.current.some((cell) => samePoint(cell, point))) {
        return null;
      }

      const key = addEatenKey(point);
      if (!key) return null;

      setCollectedCoins((count) => count + 1);

      const startAt = performance.now() + COIN_BURST_DELAY_MS;
      setCoinBursts((previous) => [
        ...previous,
        { key, x: point.x, y: point.y, startAt },
      ]);

      const timer = setTimeout(() => {
        setCoinBursts((previous) =>
          previous.filter((burst) => burst.key !== key),
        );
        burstTimersRef.current.delete(key);
      }, COIN_BURST_CLEANUP_MS);
      burstTimersRef.current.set(key, timer);

      return key;
    },
    [addEatenKey],
  );

  const markCoinEaten = useCallback(
    (point: Point) => {
      addEatenKey(point);
    },
    [addEatenKey],
  );

  /** 服务端拒绝某一步移动时，撤销这一步的乐观收集。 */
  const rollbackCoin = useCallback((key: string) => {
    if (!eatenCoinKeysRef.current.delete(key)) return;

    setEatenCoinKeys(new Set(eatenCoinKeysRef.current));
    setCollectedCoins((count) => Math.max(0, count - 1));
    setCoinBursts((previous) => previous.filter((burst) => burst.key !== key));

    const timer = burstTimersRef.current.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      burstTimersRef.current.delete(key);
    }
  }, []);

  const totalCoins = useMemo(
    () => Math.max(0, pathCells.length - 1),
    [pathCells.length],
  );

  useEffect(() => {
    const timers = burstTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return {
    collectedCoins,
    eatenCoinKeys,
    coinBursts,
    totalCoins,
    collectCoinAt,
    markCoinEaten,
    rollbackCoin,
    resetCoinCollection,
  };
}
