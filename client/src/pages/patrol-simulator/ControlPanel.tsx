import { memo } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { RobotDirection } from '@shared/api.interface';

interface ControlPanelProps {
  onMove: (direction: RobotDirection) => void;
  onReset: () => void;
  disabled?: boolean;
}

const padButtonClassName =
  'flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#0065bd] ' +
  'bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] text-white ' +
  'shadow-[0_3px_0_#1e3a8a] transition-all duration-100 ' +
  'hover:from-[#60a5fa] hover:to-[#2563eb] ' +
  'active:translate-y-0.5 active:shadow-[0_1px_0_#1e3a8a] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] focus-visible:ring-offset-2 ' +
  'select-none touch-manipulation ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  'disabled:active:translate-y-0 disabled:active:shadow-[0_3px_0_#1e3a8a]';

function ControlPanel({ onMove, onReset, disabled }: ControlPanelProps) {
  return (
    <section
      className="sim-rise overflow-hidden rounded-2xl border-2 border-[#0065bd] bg-white shadow-[0_4px_0_#1e3a8a]"
      style={{ animationDelay: '80ms' }}
    >
      <header className="flex items-center gap-2 border-b-2 border-[#93c5fd] bg-gradient-to-r from-[#dbeafe] via-[#eff6ff] to-[#bfdbfe] px-4 py-3">
        <span className="inline-block h-4 w-1 rounded-full bg-[#e52521]" />
        <SlidersHorizontal size={14} className="text-[#0065bd]" />
        <h2 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#1e3a8a]">
          手动控制
        </h2>
      </header>

      <div className="bg-gradient-to-b from-white to-[#eff6ff] p-4">
        <div className="flex select-none flex-col items-center gap-2 py-1">
          <button
            type="button"
            className={padButtonClassName}
            onClick={() => onMove('up')}
            disabled={disabled}
            aria-label="向上移动"
          >
            <ArrowUp size={18} strokeWidth={2.2} />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className={padButtonClassName}
              onClick={() => onMove('left')}
              disabled={disabled}
              aria-label="向左移动"
            >
              <ArrowLeft size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={padButtonClassName}
              onClick={() => onMove('down')}
              disabled={disabled}
              aria-label="向下移动"
            >
              <ArrowDown size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={padButtonClassName}
              onClick={() => onMove('right')}
              disabled={disabled}
              aria-label="向右移动"
            >
              <ArrowRight size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#a16207]">
          <kbd className="rounded-md border border-[#fdba74] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#78350f] shadow-[0_1px_0_#fed7aa]">
            ↑ ← ↓ →
          </kbd>
          <span className="text-[#d6b27e]">/</span>
          <kbd className="rounded-md border border-[#fdba74] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#78350f] shadow-[0_1px_0_#fed7aa]">
            WASD
          </kbd>
          键盘控制
        </p>

        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          aria-label="重置到起点"
          className="mt-4 flex w-full select-none touch-manipulation items-center justify-center gap-2 rounded-xl border-2 border-[#991b1b] bg-gradient-to-b from-[#ef4444] to-[#dc2626] px-3 py-2.5 text-sm font-extrabold text-white shadow-[0_3px_0_#7f1d1d] transition-all duration-100 hover:from-[#f87171] hover:to-[#ef4444] active:translate-y-0.5 active:shadow-[0_1px_0_#7f1d1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_3px_0_#7f1d1d]"
        >
          <RotateCcw size={15} />
          重置到起点
        </button>
      </div>
    </section>
  );
}

export default memo(ControlPanel);
