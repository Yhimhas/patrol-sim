import { memo } from 'react';
import {
  Gauge,
  Loader2,
  MapPin,
  Play,
  Route,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  MAX_CHECKPOINTS,
  PATH_ALGORITHMS,
  PATH_ALGORITHM_LABELS,
} from '@shared/api.interface';
import type { PathAlgorithm, Point } from '@shared/api.interface';

export type WalkSpeed = 1 | 2 | 4;

const WALK_SPEEDS: WalkSpeed[] = [1, 2, 4];

interface PathPanelProps {
  algorithm: PathAlgorithm;
  onAlgorithmChange: (algorithm: PathAlgorithm) => void;
  onPlan: () => void;
  onAutoWalk: () => void;
  isPlanning: boolean;
  isWalking: boolean;
  canWalk: boolean;
  pathLength?: number;
  visitedCount?: number;
  plannedAlgorithm?: PathAlgorithm;
  errorMessage?: string;
  checkpoints: Point[];
  onRemoveCheckpoint: (point: Point) => void;
  onClearCheckpoints: () => void;
  walkSpeed: WalkSpeed;
  onWalkSpeedChange: (speed: WalkSpeed) => void;
}

function PathPanel({
  algorithm,
  onAlgorithmChange,
  onPlan,
  onAutoWalk,
  isPlanning,
  isWalking,
  canWalk,
  pathLength,
  visitedCount,
  plannedAlgorithm,
  errorMessage,
  checkpoints,
  onRemoveCheckpoint,
  onClearCheckpoints,
  walkSpeed,
  onWalkSpeedChange,
}: PathPanelProps) {
  const busy = isPlanning || isWalking;
  const showResult = pathLength !== undefined && visitedCount !== undefined;

  return (
    <section
      className="sim-rise overflow-hidden rounded-2xl border-2 border-[#16a34a] bg-white shadow-[0_4px_0_#15803d]"
      style={{ animationDelay: '160ms' }}
    >
      <header className="flex items-center gap-2 border-b-2 border-[#86efac] bg-gradient-to-r from-[#f0fdf4] via-[#dcfce7] to-[#bbf7d0] px-4 py-3">
        <span className="inline-block h-4 w-1 rounded-full bg-[#e52521]" />
        <Route size={14} className="text-[#15803d]" />
        <h2 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#15803d]">
          路径规划
        </h2>
      </header>

      <div className="select-none space-y-4 bg-gradient-to-b from-white to-[#f0fdf4] p-4">
        <div>
          <label
            htmlFor="path-algorithm"
            className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#15803d]"
          >
            <Sparkles size={12} className="text-[#e8871a]" />
            算法选择
          </label>
          <Select
            value={algorithm}
            onValueChange={(value: string) =>
              onAlgorithmChange(value as PathAlgorithm)
            }
            disabled={busy}
          >
            <SelectTrigger
              id="path-algorithm"
              className="h-9 w-full rounded-xl border-2 border-[#86efac] bg-white text-xs font-semibold text-[#166534] shadow-[0_2px_0_#bbf7d0] hover:border-[#22c55e] focus:ring-[#22c55e]/40"
            >
              <SelectValue placeholder="选择算法" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-2 border-[#86efac] bg-[#fffdf7] text-[#166534] shadow-[0_4px_0_#bbf7d0]">
              {PATH_ALGORITHMS.map((item: PathAlgorithm) => (
                <SelectItem
                  key={item}
                  value={item}
                  className="text-xs font-medium focus:bg-[#dcfce7] focus:text-[#15803d]"
                >
                  {PATH_ALGORITHM_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#15803d]">
              <MapPin size={12} className="text-[#e8871a]" />
              检查点 · {checkpoints.length}/{MAX_CHECKPOINTS}
            </span>
            {checkpoints.length > 0 && (
              <button
                type="button"
                onClick={onClearCheckpoints}
                disabled={busy}
                className="flex items-center gap-1 text-[11px] font-bold text-[#b91c1c] transition-colors hover:text-[#7f1d1d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={12} />
                全部清除
              </button>
            )}
          </div>

          {checkpoints.length > 0 ? (
            <ul className="relative space-y-1.5">
              {checkpoints.length > 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 left-4 top-2 w-0.5 rounded-full bg-[#fcd34d]"
                />
              )}
              {checkpoints.map((point, index) => (
                <li
                  key={`${point.x},${point.y}`}
                  className="flex items-center justify-between rounded-xl border-2 border-[#fcd34d] bg-[#fffbeb] px-2 py-1.5 shadow-[0_2px_0_#fde68a]"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#b45309] bg-gradient-to-b from-[#fbbf24] to-[#f59e0b] text-[10px] font-bold text-[#78350f]">
                      {index + 1}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-[#78350f]">
                      ({point.x}, {point.y})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveCheckpoint(point)}
                    disabled={busy}
                    aria-label={`移除检查点 ${index + 1}`}
                    className="text-[#b45309] transition-colors hover:text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border-2 border-dashed border-[#86efac] bg-[#f0fdf4] px-2.5 py-2 text-[11px] leading-relaxed text-[#15803d]">
              点击地图空白格设置检查点（最多 {MAX_CHECKPOINTS} 个）
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#15803d]">
            <Gauge size={12} className="text-[#0065bd]" />
            巡检速度
          </span>
          <div className="flex rounded-xl border-2 border-[#fdba74] bg-[#fff7ed] p-0.5 shadow-[inset_0_1px_0_#fed7aa]">
            {WALK_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onWalkSpeedChange(speed)}
                disabled={busy}
                aria-pressed={walkSpeed === speed}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold transition-all ${
                  walkSpeed === speed
                    ? 'bg-gradient-to-b from-[#fde047] to-[#fbd000] text-[#78350f] shadow-[0_1px_0_#b45309]'
                    : 'text-[#a16207] hover:bg-[#fef3c7]'
                } touch-manipulation disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onPlan}
            disabled={busy}
            className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl border-2 border-[#9a3412] bg-gradient-to-b from-[#f97316] to-[#ea580c] px-3 py-2.5 text-sm font-extrabold text-white shadow-[0_3px_0_#9a3412] transition-all duration-100 hover:from-[#fb923c] hover:to-[#f97316] active:translate-y-0.5 active:shadow-[0_1px_0_#9a3412] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_3px_0_#9a3412]"
          >
            {isPlanning ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            {isPlanning ? '规划中…' : '开始规划'}
          </button>

          <button
            type="button"
            onClick={onAutoWalk}
            disabled={!canWalk || busy}
            className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl border-2 border-[#166534] bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-3 py-2.5 text-sm font-extrabold text-white shadow-[0_3px_0_#166534] transition-all duration-100 hover:from-[#4ade80] hover:to-[#22c55e] active:translate-y-0.5 active:shadow-[0_1px_0_#166534] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_3px_0_#166534]"
          >
            {isWalking ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Route size={15} />
            )}
            {isWalking ? '巡检中…' : '自动巡检'}
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border-2 border-[#fca5a5] bg-[#fee2e2] px-3 py-2 text-xs font-medium leading-relaxed text-[#b91c1c]"
          >
            {errorMessage}
          </div>
        )}

        {showResult && (
          <div className="space-y-3 border-t-2 border-[#bbf7d0] pt-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#15803d]">
              规划结果
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border-2 border-[#fcd34d] bg-[#fefce8] p-2.5 text-center shadow-[0_2px_0_#fde68a]">
                <p className="text-[10px] font-medium text-[#a16207]">
                  路径长度
                </p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#b45309]">
                  {pathLength}
                  <span className="ml-1 text-[10px] font-normal text-[#a16207]">
                    步
                  </span>
                </p>
              </div>
              <div className="rounded-xl border-2 border-[#93c5fd] bg-[#eff6ff] p-2.5 text-center shadow-[0_2px_0_#bfdbfe]">
                <p className="text-[10px] font-medium text-[#1d4ed8]">
                  访问节点
                </p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#1e40af]">
                  {visitedCount}
                  <span className="ml-1 text-[10px] font-normal text-[#1d4ed8]">
                    个
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-[#15803d]">规划算法</span>
              <span className="rounded-lg border-2 border-[#86efac] bg-[#dcfce7] px-2 py-0.5 font-bold text-[#15803d]">
                {plannedAlgorithm
                  ? PATH_ALGORITHM_LABELS[plannedAlgorithm]
                  : '—'}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(PathPanel);
