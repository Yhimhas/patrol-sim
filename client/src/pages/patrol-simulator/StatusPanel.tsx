import { memo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { RobotState } from '@shared/api.interface';
import { ROBOT_DIRECTION_LABELS } from '@shared/api.interface';
import {
  Activity,
  BatteryMedium,
  Coins,
  Compass,
  Footprints,
  MapPin,
  Target,
} from 'lucide-react';

interface StatusPanelProps {
  robot: RobotState;
  collectedCoins?: number;
  totalCoins?: number;
}

const LOW_BATTERY_THRESHOLD = 20;
const BATTERY_SEGMENTS = Array.from({ length: 10 }, (_, index) => index);

interface MetricRowProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

function MetricRow({ icon, label, value }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-xs font-medium text-[#9a6a33]">
        {icon}
        {label}
      </span>
      {value}
    </div>
  );
}

interface CoinCounterProps {
  collectedCoins: number;
  totalCoins?: number;
}

function CoinCounter({ collectedCoins, totalCoins }: CoinCounterProps) {
  const [announced, setAnnounced] = useState(collectedCoins);
  const showTotal = totalCoins !== undefined && totalCoins > 0;

  // 金币在高速巡检时每秒会变化很多次，延迟播报，避免读屏器连续抢读。
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(collectedCoins), 450);
    return () => clearTimeout(timer);
  }, [collectedCoins]);

  return (
    <>
      <span
        key={collectedCoins}
        className="sim-coin-pop inline-flex min-w-[3.25rem] items-center justify-center rounded-lg border-2 border-[#b45309] bg-[#fde047] px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-[#78350f] shadow-[0_2px_0_#fbbf24]"
      >
        {collectedCoins}
        {showTotal && (
          <span className="ml-1 text-[10px] font-semibold text-[#a16207]">
            / {totalCoins}
          </span>
        )}
      </span>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        已收集金币 {announced} 枚
        {showTotal ? `，共 ${totalCoins} 枚` : ''}
      </span>
    </>
  );
}

function StatusPanel({
  robot,
  collectedCoins = 0,
  totalCoins,
}: StatusPanelProps) {
  const lowBattery = robot.battery <= LOW_BATTERY_THRESHOLD;

  return (
    <section className="sim-rise overflow-hidden rounded-2xl border-2 border-[#e8871a] bg-white shadow-[0_4px_0_#c46d10]">
      <header className="flex items-center justify-between border-b-2 border-[#fdba74] bg-gradient-to-r from-[#fff7ed] via-[#fef3c7] to-[#fde68a] px-4 py-3">
        <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c2d12]">
          <span className="inline-block h-4 w-1 rounded-full bg-[#e52521]" />
          <Activity size={14} className="text-[#e8871a]" />
          状态监测
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2 py-0.5 text-[10px] font-bold ${
            lowBattery
              ? 'border-[#e11d48] bg-[#fff1f2] text-[#be123c] shadow-[0_2px_0_rgba(225,29,72,0.25)]'
              : 'border-[#16a34a] bg-[#ecfdf5] text-[#15803d] shadow-[0_2px_0_rgba(22,163,74,0.25)]'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              lowBattery ? 'animate-pulse bg-[#e11d48]' : 'bg-[#22c55e]'
            }`}
          />
          {lowBattery ? '低电量' : '运行正常'}
        </span>
      </header>

      <div className="space-y-3 bg-gradient-to-b from-white to-[#fff7ed] p-4">
        <MetricRow
          icon={<MapPin size={13} className="text-[#0065bd]" />}
          label="坐标位置"
          value={
            <span className="rounded-lg border-2 border-[#0065bd]/50 bg-[#dbeafe] px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-[#1d4ed8] shadow-[0_2px_0_#bfdbfe]">
              ({robot.x}, {robot.y})
            </span>
          }
        />

        <MetricRow
          icon={<Compass size={13} className="text-[#e8871a]" />}
          label="当前朝向"
          value={
            <span className="rounded-lg border-2 border-[#e7c9a9] bg-[#fff7ed] px-2 py-0.5 text-sm font-semibold text-[#7c2d12] shadow-[0_2px_0_#ffedd5]">
              {ROBOT_DIRECTION_LABELS[robot.direction]}
            </span>
          }
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-medium text-[#9a6a33]">
              <BatteryMedium
                size={13}
                className={lowBattery ? 'text-[#dc2626]' : 'text-[#16a34a]'}
              />
              电池电量
            </span>
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color: lowBattery ? '#dc2626' : '#1d4ed8' }}
            >
              {robot.battery}%
            </span>
          </div>
          <div
            className="flex h-3 items-stretch gap-0.5 rounded-full border-2 border-[#fdba74] bg-[#fed7aa] p-0.5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={robot.battery}
            aria-label="电池电量"
          >
            {BATTERY_SEGMENTS.map((segment) => {
              const filled = segment < Math.ceil(robot.battery / 10);
              return (
                <span
                  key={segment}
                  className={`flex-1 rounded-[3px] transition-colors duration-300 ${
                    filled
                      ? lowBattery
                        ? 'animate-pulse bg-gradient-to-b from-[#f87171] to-[#dc2626]'
                        : 'bg-gradient-to-b from-[#4ade80] to-[#16a34a]'
                      : 'bg-[#fdba74]/35'
                  }`}
                />
              );
            })}
          </div>
        </div>

        <MetricRow
          icon={<Coins size={13} className="text-[#e8a100]" />}
          label="已收集金币"
          value={
            <CoinCounter
              collectedCoins={collectedCoins}
              totalCoins={totalCoins}
            />
          }
        />

        <div className="grid grid-cols-2 gap-2 border-t-2 border-[#fde68a] pt-3">
          <div className="rounded-xl border-2 border-[#ddd6fe] bg-[#f5f3ff] p-2.5 shadow-[0_2px_0_#ede9fe]">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#6d28d9]">
              <Footprints size={12} />
              已走步数
            </div>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-[#4c1d95]">
              {robot.steps}
            </p>
          </div>
          <div className="rounded-xl border-2 border-[#fed7aa] bg-[#fff7ed] p-2.5 shadow-[0_2px_0_#ffedd5]">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#c2410c]">
              <Target size={12} />
              距终点
            </div>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-[#9a3412]">
              {robot.manhattanDistance}
              <span className="ml-1 text-[10px] font-normal text-[#c2410c]">
                格
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(StatusPanel);
