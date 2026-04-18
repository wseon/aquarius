"use client";

import { useState } from "react";
import { useLayerStore } from "@/stores/layerStore";

const LAYERS = [
  { key: "facilities", label: "항만시설", icon: "⊞" },
  { key: "seabed", label: "해저지형", icon: "▦" },
  { key: "currentFlow", label: "해류 벡터", icon: "〰" },
  { key: "vessels", label: "선박", icon: "▷" },
  { key: "channels", label: "항로/정박지", icon: "⬡" },
  { key: "dangerZones", label: "위험구역", icon: "△" },
  { key: "pollution", label: "오염 확산", icon: "⊗" },
  { key: "grid", label: "격자", icon: "▤" },
];

export default function LayerPanel() {
  const store = useLayerStore();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  const handleRefreshDepth = async () => {
    setRefreshing(true);
    setRefreshMsg("API 호출 중...");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/refresh-depth`, { method: "POST" });
      const result = await res.json();

      if (result.success) {
        setRefreshMsg(`갱신 완료 (${result.rawPoints}개 실측)`);
        // 페이지 새로고침으로 지형 재로드
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setRefreshMsg(`실패: ${result.error}`);
        setTimeout(() => setRefreshMsg(""), 3000);
      }
    } catch (e: any) {
      setRefreshMsg(`에러: ${e.message}`);
      setTimeout(() => setRefreshMsg(""), 3000);
    }

    setRefreshing(false);
  };

  return (
    <div className="absolute top-12 left-2 w-48 bg-[#0a0f1a]/95 border border-gray-800/50 rounded-lg overflow-hidden z-10">
      <div className="px-3 py-2 border-b border-gray-800/50">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Layers</p>
      </div>
      <div className="p-1.5 space-y-0.5">
        {LAYERS.map((l) => {
          const active = store[l.key as keyof typeof store] as boolean;
          return (
            <div key={l.key} className="flex items-center">
              <button
                onClick={() => store.toggleLayer(l.key)}
                className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  active
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-gray-600 hover:bg-gray-800/30"
                }`}
              >
                <span className="w-4 text-center text-[11px]">{l.icon}</span>
                <span>{l.label}</span>
                <span
                  className={`ml-auto w-1.5 h-1.5 rounded-full ${
                    active ? "bg-blue-400" : "bg-gray-700"
                  }`}
                />
              </button>
              {l.key === "seabed" && (
                <button
                  onClick={handleRefreshDepth}
                  disabled={refreshing}
                  className="ml-1 px-1.5 py-1.5 text-[9px] rounded bg-gray-800 text-gray-500 hover:text-cyan-400 hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="수심 데이터 갱신"
                >
                  {refreshing ? "..." : "↻"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 갱신 메시지 */}
      {refreshMsg && (
        <div className="px-3 py-1.5 border-t border-gray-800/50">
          <p className="text-[9px] text-cyan-400">{refreshMsg}</p>
        </div>
      )}
    </div>
  );
}
