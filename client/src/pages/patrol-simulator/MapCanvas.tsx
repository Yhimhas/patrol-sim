import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type {
  CellType,
  MapData,
  Point,
  RobotDirection,
  RobotState,
} from '@shared/api.interface';
import { SIM_COLORS } from './theme';
import { COIN_BURST_MS, coinKey } from './coins';
import type { CoinBurst } from './coins';

interface MapCanvasProps {
  map: MapData;
  robot: RobotState;
  visitedCells?: Point[];
  pathCells?: Point[];
  checkpointCells?: Point[];
  eatenCoinKeys?: ReadonlySet<string>;
  coinBursts?: CoinBurst[];
  onCellClick?: (point: Point) => void;
  clickable?: boolean;
}

interface BaseMapCache {
  map: MapData;
  cellSize: number;
  snapSize: number;
  mapWidth: number;
  mapHeight: number;
  canvas: HTMLCanvasElement;
}

interface Layout {
  cellSize: number;
  offsetX: number;
  offsetY: number;
}

interface RobotAnimation {
  curX: number;
  curY: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startAt: number;
}

const PADDING = 24;
const MIN_CELL_SIZE = 18;
const ROBOT_TWEEN_MS = 140;
const EMPTY_COIN_KEYS: ReadonlySet<string> = new Set();

const CELL_LABELS: Record<CellType, string> = {
  empty: '可通行',
  obstacle: '障碍物',
  start: '起点',
  target: '终点',
};

const LEGEND: Array<{ label: string; color: string; border?: string }> = [
  { label: '起点', color: SIM_COLORS.start, border: SIM_COLORS.startDark },
  { label: '终点', color: SIM_COLORS.marioYellow, border: SIM_COLORS.coinEdge },
  { label: '砖块', color: SIM_COLORS.brick, border: SIM_COLORS.brickDark },
  { label: '搜索', color: 'rgba(251, 191, 36, 0.6)', border: SIM_COLORS.coinEdge },
  { label: '金币路径', color: SIM_COLORS.coin, border: SIM_COLORS.coinEdge },
  {
    label: '检查点',
    color: SIM_COLORS.checkpointBorder,
    border: SIM_COLORS.coinEdge,
  },
  {
    label: '马里奥',
    color: SIM_COLORS.marioRed,
    border: SIM_COLORS.marioRedDark,
  },
];

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, SIM_COLORS.skyTop);
  gradient.addColorStop(1, SIM_COLORS.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const r = size * 0.5;

  // 柔和的椭圆投影，替代生硬的矩形底边
  ctx.fillStyle = SIM_COLORS.cloudShade;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.8, y + r * 0.42, r * 1.5, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SIM_COLORS.cloud;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.8, y - r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 1.6, y, r * 0.8, 0, Math.PI * 2);
  ctx.arc(x + r * 0.8, y + r * 0.1, r * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // 顶部高光，让云朵更蓬松
  ctx.fillStyle = SIM_COLORS.cloudShadow;
  ctx.beginPath();
  ctx.arc(x + r * 0.55, y - r * 0.28, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  const glow = ctx.createRadialGradient(
    x,
    y,
    radius * 0.2,
    x,
    y,
    radius * 2.6,
  );
  glow.addColorStop(0, SIM_COLORS.sunGlow);
  glow.addColorStop(1, 'rgba(255, 243, 176, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SIM_COLORS.sun;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SIM_COLORS.sunEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawHill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = SIM_COLORS.hillDark;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + width / 2, y - height, x + width, y);
  ctx.lineTo(x + width, y + height * 0.3);
  ctx.lineTo(x, y + height * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = SIM_COLORS.hill;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.05, y + 2);
  ctx.quadraticCurveTo(x + width / 2, y - height * 0.85, x + width * 0.95, y + 2);
  ctx.closePath();
  ctx.fill();
}

function drawGrassCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.fillStyle = SIM_COLORS.grass;
  ctx.fillRect(x, y, size + 1, size + 1);

  // 顶部草皮压得更薄、更淡，避免每一行都形成醒目横条
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = SIM_COLORS.grassLight;
  ctx.fillRect(x, y, size + 1, Math.max(1, size * 0.09));
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = SIM_COLORS.grassDark;
  ctx.fillRect(
    x,
    y + size * 0.09,
    size + 1,
    Math.max(1, size * 0.018),
  );
  ctx.restore();

  ctx.fillStyle = SIM_COLORS.dirt;
  ctx.fillRect(x, y + size * 0.108, size + 1, size * 0.892);
  ctx.fillStyle = SIM_COLORS.dirtDark;
  for (let i = 0; i < 2; i += 1) {
    const dotX = x + (i * size) / 2 + size * 0.2;
    const dotY = y + size * 0.5 + (i % 2) * size * 0.12;
    ctx.fillRect(dotX, dotY, size * 0.06, size * 0.06);
  }
}

function drawGrassDetail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  gx: number,
  gy: number,
): void {
  const seed = (gx * 37 + gy * 61) % 17;
  ctx.save();

  if (seed === 3 || seed === 8 || seed === 14) {
    const bladeX = x + size * (0.3 + ((gx + gy) % 3) * 0.15);
    const bladeY = y + size * 0.74;
    ctx.strokeStyle = 'rgba(46, 125, 50, 0.38)';
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bladeX, bladeY);
    ctx.lineTo(bladeX - size * 0.045, bladeY - size * 0.12);
    ctx.moveTo(bladeX, bladeY);
    ctx.lineTo(bladeX + size * 0.015, bladeY - size * 0.15);
    ctx.moveTo(bladeX, bladeY);
    ctx.lineTo(bladeX + size * 0.075, bladeY - size * 0.1);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (seed === 6 || seed === 11) {
    const flowerX = x + size * 0.66;
    const flowerY = y + size * 0.68;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 4; i += 1) {
      const angle = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(
        flowerX + Math.cos(angle) * size * 0.055,
        flowerY + Math.sin(angle) * size * 0.055,
        Math.max(1, size * 0.045),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = SIM_COLORS.coin;
    ctx.beginPath();
    ctx.arc(flowerX, flowerY, Math.max(1, size * 0.032), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBrickCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.fillStyle = SIM_COLORS.brickDark;
  ctx.fillRect(x, y, size + 1, size + 1);
  ctx.fillStyle = SIM_COLORS.brick;
  ctx.fillRect(x + 1, y + 1, size - 1, size - 1);

  // 砖面顶部高光倒角 + 底部暗部阴影，全部限制在砖块格子内部
  const bevel = Math.max(1, Math.floor(size * 0.08));
  ctx.fillStyle = SIM_COLORS.brickLight;
  ctx.fillRect(x + 2, y + 2, size - 4, bevel);
  ctx.fillStyle = SIM_COLORS.brickDark;
  ctx.fillRect(x + 2, y + size - bevel, size - 4, bevel);

  ctx.fillStyle = SIM_COLORS.stoneAccent;
  ctx.fillRect(x + 2, y + 2, size * 0.2, size * 0.08);
  ctx.fillRect(x + size * 0.55, y + size * 0.55, size * 0.15, size * 0.06);
  ctx.fillStyle = SIM_COLORS.brickLine;
  const midY = y + Math.floor(size / 2);
  ctx.fillRect(x + 1, midY, size - 2, 1);
  const quarter = Math.floor((size - 2) / 2);
  ctx.fillRect(x + 1 + quarter, y + 2, 1, midY - y - 2);
  ctx.fillRect(x + 1 + Math.floor(quarter / 2), midY + 1, 1, size - (midY - y) - 3);
  ctx.fillRect(
    x + 1 + quarter + Math.floor(quarter / 2),
    midY + 1,
    1,
    size - (midY - y) - 3,
  );
}

/**
 * 绘制静态地图底图（草地 / 砖块 / 花草）。
 * 这部分内容只随地图和格子尺寸变化，可以缓存到离屏画布。
 */
function drawMapBase(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  offsetX: number,
  offsetY: number,
  cellSize: number,
  snapSize: number,
): void {
  // 格子首尾相接填满，打底用草地同色，避免格子缝隙透出异色竖线
  ctx.fillStyle = SIM_COLORS.grass;
  ctx.fillRect(offsetX, offsetY, map.width * cellSize, map.height * cellSize);

  for (let gy = 0; gy < map.height; gy += 1) {
    for (let gx = 0; gx < map.width; gx += 1) {
      const px = Math.round(offsetX + gx * cellSize);
      const py = Math.round(offsetY + gy * cellSize);
      const type = map.grid[gy][gx];

      if (type === 'obstacle') {
        drawBrickCell(ctx, px, py, snapSize);
      } else if (type === 'empty') {
        drawGrassCell(ctx, px, py, snapSize);
        drawGrassDetail(ctx, px, py, snapSize, gx, gy);
      }
    }
  }
}

function createBaseMapCanvas(
  map: MapData,
  cellSize: number,
  snapSize: number,
  mapWidth: number,
  mapHeight: number,
  dpr: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(mapWidth * dpr));
  canvas.height = Math.max(1, Math.ceil(mapHeight * dpr));

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawMapBase(ctx, map, 0, 0, cellSize, snapSize);
  return canvas;
}

function drawStartCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  drawGrassCell(ctx, x, y, size);
  const flagX = x + size * 0.4;
  const flagY = y + size * 0.15;
  const flagHeight = size * 0.6;

  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(flagX, flagY, 2, flagHeight);

  ctx.fillStyle = SIM_COLORS.start;
  ctx.beginPath();
  ctx.moveTo(flagX + 2, flagY);
  ctx.lineTo(flagX + size * 0.3, flagY + size * 0.12);
  ctx.lineTo(flagX + 2, flagY + size * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = SIM_COLORS.startDark;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTargetCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number,
): void {
  drawGrassCell(ctx, x, y, size);
  const pulse = 0.85 + Math.sin(time * 0.005) * 0.15;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const starRadius = size * 0.32 * pulse;

  ctx.fillStyle = SIM_COLORS.marioYellow;
  ctx.strokeStyle = SIM_COLORS.coinEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    const ox = cx + Math.cos(outerAngle) * starRadius;
    const oy = cy + Math.sin(outerAngle) * starRadius;
    const ix = cx + Math.cos(innerAngle) * starRadius * 0.45;
    const iy = cy + Math.sin(innerAngle) * starRadius * 0.45;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 环绕星星的小闪光，强化终点的“奖励感”
  for (let i = 0; i < 3; i += 1) {
    const angle = time * 0.0015 + (i * Math.PI * 2) / 3;
    const orbit = size * 0.4;
    const sx = cx + Math.cos(angle) * orbit;
    const sy = cy + Math.sin(angle) * orbit * 0.62;
    const twinkle = 0.55 + Math.sin(time * 0.006 + i * 1.7) * 0.45;
    const s = Math.max(1, size * 0.032 * (0.7 + twinkle * 0.5));
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `rgba(253, 224, 71, ${0.45 + twinkle * 0.5})`;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  }
}

function drawVisitedCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  progress: number,
): void {
  ctx.save();
  // 保留“越晚访问越亮”的搜索动画层次，同时使用马里奥金币的琥珀色。
  ctx.globalAlpha = 0.35 + progress * 0.65;
  ctx.fillStyle = SIM_COLORS.visited;
  ctx.fillRect(x + 1, y + 1, size - 3, size - 3);
  ctx.fillStyle = SIM_COLORS.visitedInner;
  ctx.fillRect(x + size * 0.25, y + size * 0.25, size * 0.5, size * 0.5);
  ctx.restore();
}

function drawPathCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number,
  index: number,
): void {
  const pulse = 0.7 + Math.sin(time * 0.006 + index * 0.5) * 0.3;
  ctx.fillStyle = SIM_COLORS.pathPlate;
  ctx.globalAlpha = 0.5 + pulse * 0.5;
  ctx.fillRect(x + 1, y + 1, size - 3, size - 3);
  ctx.globalAlpha = 1;

  const coinRadius = size * 0.2;
  const cx = x + size / 2;
  const cy = y + size / 2 + Math.sin(time * 0.008 + index) * 2;
  const scaleX = 0.6 + Math.abs(Math.sin(time * 0.004 + index * 0.7)) * 0.4;

  // 用半透明椭圆代替 ctx.shadowBlur：路径长时每帧少做一次模糊，
  // 视觉效果接近，移动端更稳。
  ctx.fillStyle = 'rgba(120, 53, 15, 0.18)';
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy + coinRadius * 0.85,
    coinRadius * 0.85,
    coinRadius * 0.28,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = SIM_COLORS.coin;
  ctx.strokeStyle = SIM_COLORS.coinEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, coinRadius * scaleX, coinRadius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (scaleX > 0.4) {
    ctx.fillStyle = SIM_COLORS.coinHighlight;
    ctx.fillRect(cx - 1, cy - coinRadius * 0.4, 2, coinRadius * 0.8);
  }
}

function drawCoinBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  progress: number,
  showLabel: boolean,
): void {
  const clamped = Math.min(1, Math.max(0, progress));
  const fade = clamped < 0.62 ? 1 : 1 - (clamped - 0.62) / 0.38;
  const cx = x + size / 2;
  const baseY = y + size / 2;
  const coinR = size * 0.2;

  ctx.save();
  ctx.globalAlpha = fade;

  // 扩散光环
  ctx.strokeStyle = `rgba(253, 224, 71, ${0.7 * (1 - clamped)})`;
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.beginPath();
  ctx.arc(cx, baseY, coinR * (1.1 + clamped * 1.9), 0, Math.PI * 2);
  ctx.stroke();

  // 金币先放大并快速翻转，再向上飘
  const grow = 1 + Math.sin(Math.min(1, clamped / 0.7) * Math.PI) * 0.55;
  const flip = Math.cos(clamped * Math.PI * 2);
  const coinY = baseY - clamped * size * 0.42;

  // 轻量椭圆投影，替代成本较高的 shadowBlur
  ctx.fillStyle = 'rgba(120, 53, 15, 0.16)';
  ctx.beginPath();
  ctx.ellipse(
    cx,
    baseY + coinR * 0.9,
    coinR * (0.85 + clamped * 0.3),
    coinR * 0.24,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.save();
  ctx.translate(cx, coinY);
  ctx.scale(Math.max(0.08, Math.abs(flip)) * grow, grow);
  ctx.fillStyle = SIM_COLORS.coin;
  ctx.strokeStyle = SIM_COLORS.coinEdge;
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.ellipse(0, 0, coinR, coinR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SIM_COLORS.coinHighlight;
  const shineWidth = Math.max(1, size * 0.035);
  ctx.fillRect(-shineWidth / 2, -coinR * 0.45, shineWidth, coinR * 0.9);
  ctx.restore();

  // 小星光向四周飞散
  for (let i = 0; i < 3; i += 1) {
    const angle = -Math.PI / 2 + (i - 1) * 0.85;
    const distance = size * 0.16 + clamped * size * 0.34;
    const sx = cx + Math.cos(angle) * distance;
    const sy =
      baseY + Math.sin(angle) * distance * 0.8 - clamped * size * 0.16;
    const sparkle = Math.max(1, size * 0.045 * (1 - clamped * 0.55));
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#ffffff';
    ctx.fillRect(-sparkle, -sparkle, sparkle * 2, sparkle * 2);
    ctx.restore();
  }

  // 向上飘出的 +1；高速巡检时只给最近几颗金币保留文字，减少重叠
  if (showLabel) {
    const labelAlpha = fade * Math.min(1, clamped / 0.2);
    const labelY = baseY - size * 0.28 - clamped * size * 0.55;
    ctx.save();
    ctx.globalAlpha = labelAlpha;
    ctx.font = `bold ${Math.max(10, Math.floor(size * 0.26))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.7)';
    ctx.fillStyle = '#fff7d6';
    ctx.strokeText('+1', cx, labelY);
    ctx.fillText('+1', cx, labelY);
    ctx.restore();
  }

  ctx.restore();
}

function drawCheckpointCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  index: number,
  time: number,
): void {
  const bounce = Math.sin(time * 0.005 + index) * 2;
  const cx = x + size / 2;
  const flagTop = y + size * 0.15 + bounce;
  const flagBottom = y + size * 0.85;
  const poleX = cx - 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.ellipse(
    cx,
    flagBottom + size * 0.04,
    size * 0.14,
    size * 0.035,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = SIM_COLORS.checkpointPole;
  ctx.fillRect(poleX, flagTop, 2, flagBottom - flagTop);

  ctx.fillStyle = SIM_COLORS.checkpointBorder;
  const flagWidth = size * 0.3;
  const flagHeight = size * 0.25;
  ctx.beginPath();
  ctx.moveTo(poleX + 2, flagTop + size * 0.05);
  ctx.lineTo(poleX + 2 + flagWidth, flagTop + size * 0.05 + flagHeight / 2);
  ctx.lineTo(poleX + 2, flagTop + size * 0.05 + flagHeight);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = SIM_COLORS.coinEdge;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 251, 235, 0.92)';
  ctx.beginPath();
  ctx.arc(cx, flagBottom + size * 0.08, size * 0.115, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SIM_COLORS.checkpointBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = SIM_COLORS.checkpointText;
  ctx.font = `bold ${Math.floor(size * 0.2)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), cx, flagBottom + size * 0.08);
}

function drawMario(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  direction: RobotDirection,
  time: number,
): void {
  const bounce = Math.sin(time * 0.012) * size * 0.06;
  const breathY = Math.sin(time * 0.003) * size * 0.02;
  const baseY = cy + breathY - bounce;

  const pixel = size / 16;
  const flipX = direction === 'left' ? -1 : 1;
  const rotation =
    direction === 'up' ? -Math.PI / 2 : direction === 'down' ? Math.PI / 2 : 0;

  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(rotation);
  ctx.scale(flipX, 1);

  const originX = -size * 0.38;
  const originY = -size * 0.45;

  const p = (
    col: number,
    row: number,
    width: number,
    height: number,
    color: string,
  ) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      originX + col * pixel,
      originY + row * pixel,
      width * pixel,
      height * pixel,
    );
  };

  p(3, 0, 7, 1, SIM_COLORS.marioRed);
  p(2, 1, 9, 1, SIM_COLORS.marioRed);
  p(1, 2, 11, 1, SIM_COLORS.marioRed);
  p(5, 2, 3, 1, '#ffffff');
  p(0, 3, 1, 1, SIM_COLORS.marioRed);
  p(1, 3, 2, 1, SIM_COLORS.marioBrown);
  p(3, 3, 2, 1, '#ffffff');
  p(5, 3, 3, 1, SIM_COLORS.marioRed);
  p(8, 3, 2, 1, '#ffffff');
  p(10, 3, 2, 1, SIM_COLORS.marioBrown);
  p(12, 3, 1, 1, SIM_COLORS.marioRed);
  p(1, 4, 2, 1, SIM_COLORS.marioBrown);
  p(3, 4, 2, 1, SIM_COLORS.marioSkin);
  p(5, 4, 1, 1, SIM_COLORS.marioBrown);
  p(6, 4, 2, 1, SIM_COLORS.marioSkin);
  p(8, 4, 1, 1, SIM_COLORS.marioBrown);
  p(9, 4, 2, 1, SIM_COLORS.marioSkin);
  p(11, 4, 2, 1, SIM_COLORS.marioBrown);
  p(1, 5, 1, 1, SIM_COLORS.marioBrown);
  p(2, 5, 1, 1, SIM_COLORS.marioSkin);
  p(3, 5, 1, 1, SIM_COLORS.marioMustache);
  p(4, 5, 1, 1, SIM_COLORS.marioSkin);
  p(5, 5, 1, 1, SIM_COLORS.marioSkin);
  p(6, 5, 1, 1, SIM_COLORS.marioSkin);
  p(7, 5, 1, 1, SIM_COLORS.marioSkin);
  p(8, 5, 1, 1, SIM_COLORS.marioSkin);
  p(9, 5, 1, 1, SIM_COLORS.marioSkin);
  p(10, 5, 1, 1, SIM_COLORS.marioMustache);
  p(11, 5, 1, 1, SIM_COLORS.marioSkin);
  p(12, 5, 1, 1, SIM_COLORS.marioBrown);
  p(2, 6, 1, 1, SIM_COLORS.marioSkin);
  p(3, 6, 3, 1, SIM_COLORS.marioMustache);
  p(6, 6, 2, 1, SIM_COLORS.marioSkin);
  p(8, 6, 3, 1, SIM_COLORS.marioMustache);
  p(11, 6, 1, 1, SIM_COLORS.marioSkin);
  p(3, 7, 2, 1, SIM_COLORS.marioSkin);
  p(5, 7, 4, 1, SIM_COLORS.marioSkin);
  p(9, 7, 2, 1, SIM_COLORS.marioSkin);
  p(6, 7, 2, 1, SIM_COLORS.marioMustache);
  p(4, 8, 6, 1, SIM_COLORS.marioRed);
  p(2, 9, 1, 1, SIM_COLORS.marioRed);
  p(3, 9, 2, 1, SIM_COLORS.marioBlue);
  p(5, 9, 4, 1, SIM_COLORS.marioRed);
  p(9, 9, 2, 1, SIM_COLORS.marioBlue);
  p(11, 9, 1, 1, SIM_COLORS.marioRed);
  p(1, 10, 2, 1, SIM_COLORS.marioGlove);
  p(3, 10, 2, 1, SIM_COLORS.marioBlue);
  p(4, 10, 1, 1, SIM_COLORS.marioYellow);
  p(5, 10, 4, 1, SIM_COLORS.marioBlue);
  p(9, 10, 1, 1, SIM_COLORS.marioYellow);
  p(9, 10, 2, 1, SIM_COLORS.marioBlue);
  p(11, 10, 2, 1, SIM_COLORS.marioGlove);
  p(0, 11, 2, 1, SIM_COLORS.marioGlove);
  p(2, 11, 10, 1, SIM_COLORS.marioBlue);
  p(12, 11, 2, 1, SIM_COLORS.marioGlove);
  p(3, 12, 8, 1, SIM_COLORS.marioBlue);
  p(3, 13, 3, 1, SIM_COLORS.marioBlue);
  p(8, 13, 3, 1, SIM_COLORS.marioBlue);
  p(3, 14, 3, 1, SIM_COLORS.marioBrown);
  p(8, 14, 3, 1, SIM_COLORS.marioBrown);
  p(2, 15, 4, 1, SIM_COLORS.marioShoe);
  p(8, 15, 4, 1, SIM_COLORS.marioShoe);

  ctx.restore();

  const shadowWidth = size * 0.5;
  const shadowHeight = size * 0.08;
  const shadowAlpha = 0.2 - (Math.abs(bounce) / size) * 0.1;
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.42, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMarioRobot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  direction: RobotDirection,
  time: number,
): void {
  const size = cellSize * 0.38 * 2;
  drawMario(ctx, cx, cy, size * 0.95, direction, time);
}

function drawHover(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.fillStyle = SIM_COLORS.hoverFill;
  roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 4);
  ctx.fill();
  ctx.strokeStyle = SIM_COLORS.hoverBorder;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 1.5, y + 1.5, size - 3, size - 3, 4);
  ctx.stroke();
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  pointerX: number,
  pointerY: number,
  text: string,
): void {
  ctx.font =
    '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + 16;
  const boxHeight = 24;

  let boxX = pointerX + 14;
  let boxY = pointerY + 14;
  if (boxX + boxWidth > canvasWidth - 6) boxX = pointerX - boxWidth - 14;
  if (boxY + boxHeight > canvasHeight - 6) boxY = pointerY - boxHeight - 14;

  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 6);
  ctx.save();
  ctx.shadowColor = 'rgba(60, 40, 10, 0.22)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = SIM_COLORS.tooltipBg;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = SIM_COLORS.tooltipBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = SIM_COLORS.tooltipText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, boxX + 8, boxY + boxHeight / 2 + 0.5);
}

export default function MapCanvas({
  map,
  robot,
  visitedCells = [],
  pathCells = [],
  checkpointCells = [],
  eatenCoinKeys = EMPTY_COIN_KEYS,
  coinBursts = [],
  onCellClick,
  clickable = false,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<Layout>({ cellSize: 0, offsetX: 0, offsetY: 0 });
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  // 动态数据放在 ref 中：只启动一条 rAF 循环，
  // 避免 visitedCells 每帧更新时销毁/重建渲染循环。
  const liveRef = useRef({
    map,
    robot,
    visitedCells,
    pathCells,
    checkpointCells,
    eatenCoinKeys,
    coinBursts,
    clickable,
  });

  const animRef = useRef<RobotAnimation>({
    curX: robot.x,
    curY: robot.y,
    fromX: robot.x,
    fromY: robot.y,
    toX: robot.x,
    toY: robot.y,
    startAt: 0,
  });

  useEffect(() => {
    liveRef.current = {
      map,
      robot,
      visitedCells,
      pathCells,
      checkpointCells,
      eatenCoinKeys,
      coinBursts,
      clickable,
    };
  });

  // 机器人格间平滑移动；重置等大跨度位移直接吸附
  useEffect(() => {
    const anim = animRef.current;
    if (anim.toX === robot.x && anim.toY === robot.y) return;

    const distance =
      Math.abs(robot.x - anim.curX) + Math.abs(robot.y - anim.curY);
    if (distance > 2) {
      anim.curX = robot.x;
      anim.curY = robot.y;
      anim.fromX = robot.x;
      anim.fromY = robot.y;
      anim.toX = robot.x;
      anim.toY = robot.y;
      anim.startAt = 0;
      return;
    }

    anim.fromX = anim.curX;
    anim.fromY = anim.curY;
    anim.toX = robot.x;
    anim.toY = robot.y;
    anim.startAt = performance.now();
  }, [robot.x, robot.y]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;
    let frame = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    let baseCache: BaseMapCache | null = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        width = rect.width;
        height = rect.height;
      }
    });
    resizeObserver.observe(container);
    const initialRect = container.getBoundingClientRect();
    width = initialRect.width;
    height = initialRect.height;

    const schedule = (): void => {
      if (disposed || !visible || frame !== 0) return;
      frame = requestAnimationFrame(render);
    };

    // 地图滚出视口时暂停 rAF，减少移动端无意义的持续重绘
    const intersectionObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              visible = entries[0]?.isIntersecting ?? true;
              if (visible) {
                schedule();
              } else if (frame !== 0) {
                cancelAnimationFrame(frame);
                frame = 0;
              }
            },
            { rootMargin: '160px' },
          );
    intersectionObserver?.observe(container);

    function render(now: number): void {
      frame = 0;
      if (disposed || !visible) return;

      if (width <= 0 || height <= 0) {
        schedule();
        return;
      }

      const pixelWidth = Math.floor(width * dpr);
      const pixelHeight = Math.floor(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      const live = liveRef.current;
      const currentMap = live.map;
      const time = reducedMotion ? 0 : now;

      drawSky(ctx, width, height);

      // 暖色太阳藏在云层后面，给画面一点纵深
      drawSun(
        ctx,
        width * 0.84,
        height * 0.16,
        Math.max(10, Math.min(width, height) * 0.024),
      );

      // 飘动的云层
      const cloudOffset = (time * 0.01) % (width + 200);
      drawCloud(
        ctx,
        ((width * 0.1 + cloudOffset) % (width + 200)) - 100,
        height * 0.12,
        28,
      );
      drawCloud(
        ctx,
        ((width * 0.45 + cloudOffset * 0.8) % (width + 200)) - 100,
        height * 0.25,
        22,
      );
      drawCloud(
        ctx,
        ((width * 0.75 + cloudOffset * 1.2) % (width + 200)) - 100,
        height * 0.12 + 10,
        24,
      );

      const cellSize = Math.max(
        MIN_CELL_SIZE,
        Math.floor(
          Math.min(
            (width - PADDING * 2) / currentMap.width,
            (height - PADDING * 2) / currentMap.height,
          ),
        ),
      );
      const mapWidth = currentMap.width * cellSize;
      const mapHeight = currentMap.height * cellSize;
      const offsetX = Math.floor((width - mapWidth) / 2);
      const offsetY = Math.floor((height - mapHeight) / 2);
      const snapSize = Math.floor(cellSize);
      const layout: Layout = { cellSize, offsetX, offsetY };
      layoutRef.current = layout;

      // 地图两侧远山（被地图遮住的部分不可见，只露出边缘）
      const hillBaseY = offsetY + mapHeight * 0.25;
      ctx.globalAlpha = 0.6;
      drawHill(ctx, offsetX - 20, hillBaseY, mapWidth * 0.35, mapHeight * 0.2);
      drawHill(
        ctx,
        offsetX + mapWidth * 0.4,
        hillBaseY + 10,
        mapWidth * 0.4,
        mapHeight * 0.18,
      );
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.beginPath();
      ctx.rect(offsetX, offsetY, mapWidth, mapHeight);
      ctx.clip();

      if (
        !baseCache ||
        baseCache.map !== currentMap ||
        baseCache.cellSize !== cellSize ||
        baseCache.snapSize !== snapSize ||
        baseCache.mapWidth !== mapWidth ||
        baseCache.mapHeight !== mapHeight
      ) {
        const canvas = createBaseMapCanvas(
          currentMap,
          cellSize,
          snapSize,
          mapWidth,
          mapHeight,
          dpr,
        );
        baseCache = canvas
          ? {
              map: currentMap,
              cellSize,
              snapSize,
              mapWidth,
              mapHeight,
              canvas,
            }
          : null;
      }

      if (baseCache) {
        // 缓存本身就是按 dpr 绘制的，用设备像素 1:1 贴回，避免二次缩放产生毛边
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(
          baseCache.canvas,
          Math.round(offsetX * dpr),
          Math.round(offsetY * dpr),
        );
        ctx.restore();
      } else {
        drawMapBase(ctx, currentMap, offsetX, offsetY, cellSize, snapSize);
      }

      // 搜索访问顺序：越晚访问越亮
      const visited = live.visitedCells;
      for (let i = 0; i < visited.length; i += 1) {
        const point = visited[i];
        if (
          point.x < 0 ||
          point.x >= currentMap.width ||
          point.y < 0 ||
          point.y >= currentMap.height
        ) {
          continue;
        }
        const progress = visited.length <= 1 ? 1 : i / (visited.length - 1);
        drawVisitedCell(
          ctx,
          Math.round(offsetX + point.x * cellSize),
          Math.round(offsetY + point.y * cellSize),
          snapSize,
          progress,
        );
      }

      for (let i = 0; i < live.pathCells.length; i += 1) {
        const point = live.pathCells[i];
        if (
          point.x < 0 ||
          point.x >= currentMap.width ||
          point.y < 0 ||
          point.y >= currentMap.height ||
          live.eatenCoinKeys.has(coinKey(point))
        ) {
          continue;
        }
        drawPathCell(
          ctx,
          Math.round(offsetX + point.x * cellSize),
          Math.round(offsetY + point.y * cellSize),
          snapSize,
          time,
          i,
        );
      }

      // 起点旗子与终点星星盖在路径金币之上，保证始终可辨认
      for (let gy = 0; gy < currentMap.height; gy += 1) {
        for (let gx = 0; gx < currentMap.width; gx += 1) {
          const type = currentMap.grid[gy][gx];
          if (type !== 'start' && type !== 'target') continue;
          const px = Math.round(offsetX + gx * cellSize);
          const py = Math.round(offsetY + gy * cellSize);
          if (type === 'start') {
            drawStartCell(ctx, px, py, snapSize);
          } else {
            drawTargetCell(ctx, px, py, snapSize, time);
          }
        }
      }

      for (let i = 0; i < live.checkpointCells.length; i += 1) {
        const point = live.checkpointCells[i];
        if (
          point.x < 0 ||
          point.x >= currentMap.width ||
          point.y < 0 ||
          point.y >= currentMap.height
        ) {
          continue;
        }
        drawCheckpointCell(
          ctx,
          Math.round(offsetX + point.x * cellSize),
          Math.round(offsetY + point.y * cellSize),
          snapSize,
          i,
          time,
        );
      }

      // 机器人（带格间补间）
      const anim = animRef.current;
      if (anim.startAt > 0) {
        const progress = reducedMotion
          ? 1
          : Math.min(1, (now - anim.startAt) / ROBOT_TWEEN_MS);
        const eased = easeInOutCubic(progress);
        anim.curX = anim.fromX + (anim.toX - anim.fromX) * eased;
        anim.curY = anim.fromY + (anim.toY - anim.fromY) * eased;
        if (progress >= 1) {
          anim.curX = anim.toX;
          anim.curY = anim.toY;
          anim.startAt = 0;
        }
      } else {
        anim.curX = anim.toX;
        anim.curY = anim.toY;
      }

      const robotCx = offsetX + anim.curX * cellSize + cellSize / 2;
      const robotCy = offsetY + anim.curY * cellSize + cellSize / 2;
      drawMarioRobot(ctx, robotCx, robotCy, cellSize, live.robot.direction, time);

      // 已吃金币的短时爆金币动画（缩小动效偏好下只隐藏金币，不做动画）
      if (!reducedMotion) {
        // 高速巡检会同时存在很多爆金币动画；只给最近 3 颗保留 “+1” 文字，
        // 其余仅保留星光，避免文字堆叠。
        const labelThreshold = Math.max(0, live.coinBursts.length - 3);
        for (let i = 0; i < live.coinBursts.length; i += 1) {
          const burst = live.coinBursts[i];
          if (
            burst.x < 0 ||
            burst.x >= currentMap.width ||
            burst.y < 0 ||
            burst.y >= currentMap.height
          ) {
            continue;
          }
          const progress = (now - burst.startAt) / COIN_BURST_MS;
          if (progress < 0 || progress >= 1) continue;
          drawCoinBurst(
            ctx,
            Math.round(offsetX + burst.x * cellSize),
            Math.round(offsetY + burst.y * cellSize),
            snapSize,
            progress,
            i >= labelThreshold,
          );
        }
      }

      ctx.restore();

      // 地图边框：外圈深棕投影 + 内圈奶油高光
      ctx.strokeStyle = SIM_COLORS.frameDark;
      ctx.lineWidth = 3;
      ctx.strokeRect(
        offsetX - 2.5,
        offsetY - 2.5,
        mapWidth + 5,
        mapHeight + 5,
      );
      ctx.strokeStyle = SIM_COLORS.frameLight;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        offsetX + 0.5,
        offsetY + 0.5,
        mapWidth - 1,
        mapHeight - 1,
      );

      // 悬停高亮 + 坐标提示
      const pointer = pointerRef.current;
      if (pointer) {
        const gx = Math.floor((pointer.x - offsetX) / cellSize);
        const gy = Math.floor((pointer.y - offsetY) / cellSize);
        if (
          gx >= 0 &&
          gx < currentMap.width &&
          gy >= 0 &&
          gy < currentMap.height
        ) {
          drawHover(
            ctx,
            offsetX + gx * cellSize,
            offsetY + gy * cellSize,
            cellSize,
          );
          const type = currentMap.grid[gy][gx];
          drawTooltip(
            ctx,
            width,
            height,
            pointer.x,
            pointer.y,
            `(${gx}, ${gy}) · ${CELL_LABELS[type]}`,
          );
        }
      }

      schedule();
    }

    schedule();

    return () => {
      disposed = true;
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
    };
  }, []);

  const handleCanvasClick = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      if (!clickable || !onCellClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const { cellSize, offsetX, offsetY } = layoutRef.current;
      if (cellSize === 0) return;

      const gridX = Math.floor((x - offsetX) / cellSize);
      const gridY = Math.floor((y - offsetY) / cellSize);
      if (gridX < 0 || gridX >= map.width || gridY < 0 || gridY >= map.height) {
        return;
      }

      const cellType = map.grid[gridY][gridX];
      if (cellType === 'empty') {
        onCellClick({ x: gridX, y: gridY });
      }
    },
    [map, clickable, onCellClick],
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    pointerRef.current = null;
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className={`block h-full w-full ${clickable ? 'cursor-crosshair' : ''}`}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="img"
        aria-label={`巡检地图，${map.width} 列 × ${map.height} 行。点击空白格可设置检查点。`}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border-2 border-[#8b5a2b] bg-[rgba(255,251,235,0.94)] px-3 py-2 text-[10px] font-medium text-[#78350f] shadow-[0_3px_0_rgba(107,66,32,0.35)] backdrop-blur-sm">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px] border"
              style={{
                backgroundColor: item.color,
                borderColor: item.border ?? item.color,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
