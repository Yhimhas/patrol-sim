import type { Point } from '@shared/api.interface';

export interface CoinBurst {
  key: string;
  x: number;
  y: number;
  startAt: number;
}

/** 爆金币动画时长。 */
export const COIN_BURST_MS = 420;

/**
 * 延迟爆金币动画，让金币在机器人补间接近目标格时再炸开，
 * 避免高速巡检时出现“金币先炸、马里奥后到”的割裂感。
 */
export const COIN_BURST_DELAY_MS = 60;

/** 状态清理计时器比动画多留一点余量，避免最后一帧被提前移除。 */
export const COIN_BURST_CLEANUP_MS =
  COIN_BURST_DELAY_MS + COIN_BURST_MS + 80;

export function coinKey(point: Point): string {
  return `${point.x},${point.y}`;
}
