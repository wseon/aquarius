"use client";

import { useEffect, useState } from "react";

interface TideRecord {
  stationName: string;
  datetime: string;
  measured: number;
  predicted: number;
}

export default function TidePanel() {
  const [records, setRecords] = useState<TideRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/tide`);
        const data = await res.json();
        setRecords(data.records || []);
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, []);

  const currentHour = new Date().getHours();
  const currentRecord = records.find((r) => {
    const hour = parseInt(r.datetime.split(" ")[1]?.split(":")[0] || "0");
    return hour === currentHour;
  });

  const maxTide = Math.max(...records.map((r) => r.measured || r.predicted || 0));
  const minTide = Math.min(...records.map((r) => r.measured || r.predicted || Infinity));

  return (
    <div className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur px-4 py-3 rounded-lg w-64">
      <h2 className="text-sm font-bold mb-2">인천 조위 (DT_0001)</h2>

      {loading ? (
        <p className="text-xs text-gray-400">조위 데이터 로딩 중...</p>
      ) : records.length === 0 ? (
        <p className="text-xs text-gray-400">데이터 없음</p>
      ) : (
        <>
          {/* 현재 조위 */}
          {currentRecord && (
            <div className="mb-2 p-2 bg-blue-900/50 rounded">
              <p className="text-xs text-gray-400">현재 조위</p>
              <p className="text-2xl font-bold">
                {(currentRecord.measured || currentRecord.predicted).toFixed(0)}
                <span className="text-sm text-gray-400 ml-1">cm</span>
              </p>
            </div>
          )}

          {/* 만조/간조 */}
          <div className="flex gap-2 mb-2">
            <div className="flex-1 p-1.5 bg-red-900/30 rounded text-center">
              <p className="text-[10px] text-gray-400">최고(만조)</p>
              <p className="text-sm font-bold">{maxTide.toFixed(0)}cm</p>
            </div>
            <div className="flex-1 p-1.5 bg-green-900/30 rounded text-center">
              <p className="text-[10px] text-gray-400">최저(간조)</p>
              <p className="text-sm font-bold">{minTide.toFixed(0)}cm</p>
            </div>
          </div>

          {/* 미니 그래프 */}
          <div className="flex items-end gap-px h-12">
            {records.map((r, i) => {
              const val = r.measured || r.predicted;
              const height = ((val - minTide) / (maxTide - minTide)) * 100;
              const isCurrent =
                parseInt(r.datetime.split(" ")[1]?.split(":")[0] || "0") ===
                currentHour;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t ${isCurrent ? "bg-yellow-400" : "bg-blue-400/60"}`}
                  style={{ height: `${Math.max(height, 4)}%` }}
                  title={`${r.datetime} | ${val.toFixed(0)}cm`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
            <span>00시</span>
            <span>12시</span>
            <span>23시</span>
          </div>
        </>
      )}
    </div>
  );
}
