"use client";

import { useEffect, useState } from "react";
import { useLayerStore } from "@/stores/layerStore";

interface TideRecord {
  datetime: string;
  measured: number;
  predicted: number;
}

export default function InfoPanel() {
  const [tideData, setTideData] = useState<TideRecord[]>([]);
  const timeHour = useLayerStore((s) => s.timeHour);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/tide`)
      .then((r) => r.json())
      .then((d) => setTideData(d.records || []))
      .catch(() => {});
  }, []);

  const currentTide = tideData[timeHour];
  const maxTide = Math.max(...tideData.map((r) => r.measured || r.predicted || 0));
  const minTide = Math.min(
    ...tideData.map((r) => r.measured || r.predicted || Infinity)
  );

  return (
    <div className="absolute top-12 right-2 w-56 bg-[#0a0f1a]/95 border border-gray-800/50 rounded-lg overflow-hidden z-10">
      {/* 조위 */}
      <div className="px-3 py-2 border-b border-gray-800/50">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
          Tide Level — 인천 (DT_0001)
        </p>
      </div>
      <div className="p-3">
        {currentTide ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">
                {(currentTide.measured || currentTide.predicted).toFixed(0)}
              </span>
              <span className="text-xs text-gray-500">cm</span>
            </div>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 bg-red-500/10 rounded px-2 py-1">
                <p className="text-[9px] text-gray-500">만조</p>
                <p className="text-xs font-bold text-red-400">
                  {maxTide.toFixed(0)}cm
                </p>
              </div>
              <div className="flex-1 bg-emerald-500/10 rounded px-2 py-1">
                <p className="text-[9px] text-gray-500">간조</p>
                <p className="text-xs font-bold text-emerald-400">
                  {minTide.toFixed(0)}cm
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-600">로딩 중...</p>
        )}

        {/* 미니 차트 */}
        {tideData.length > 0 && (
          <div className="flex items-end gap-px h-10 mt-3">
            {tideData.map((r, i) => {
              const val = r.measured || r.predicted;
              const pct = ((val - minTide) / (maxTide - minTide)) * 100;
              const isCurrent = i === timeHour;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-colors ${
                    isCurrent ? "bg-yellow-400" : "bg-blue-500/40"
                  }`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                  title={`${r.datetime} | ${val.toFixed(0)}cm`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 기상 (모의 데이터) */}
      <div className="px-3 py-2 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
          Weather
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[9px] text-gray-500">풍향/풍속</p>
            <p className="text-gray-300">NW 6.2 m/s</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500">시정</p>
            <p className="text-gray-300">8.5 km</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500">파고</p>
            <p className="text-gray-300">0.8 m</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500">수온</p>
            <p className="text-gray-300">12.3 °C</p>
          </div>
        </div>
      </div>

      {/* 경고 */}
      <div className="px-3 py-2 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
          Alerts
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span className="text-yellow-400/80">조류 변화 주의 (15:00)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-gray-500">시스템 정상</span>
          </div>
        </div>
      </div>
    </div>
  );
}
