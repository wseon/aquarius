"use client";

import { useLayerStore } from "@/stores/layerStore";

const LAYERS = [
  { key: "bathymetry", label: "수심 지형", icon: "▦" },
  { key: "currentFlow", label: "해류 흐름", icon: "〰" },
  { key: "channels", label: "항로/정박지", icon: "⬡" },
  { key: "dangerZones", label: "위험구역", icon: "△" },
  { key: "facilities", label: "항만시설", icon: "⊞" },
  { key: "vessels", label: "선박", icon: "▷" },
  { key: "waterSurface", label: "해수면", icon: "≈" },
  { key: "waterTemp", label: "수온", icon: "◉" },
  { key: "salinity", label: "염분", icon: "◈" },
  { key: "pollution", label: "오염 확산", icon: "⊗" },
];

const DEPTH_FILTERS = [
  { key: "all" as const, label: "전체" },
  { key: "surface" as const, label: "표층 (0-5m)" },
  { key: "mid" as const, label: "중층 (5-15m)" },
  { key: "bottom" as const, label: "저층 (15m+)" },
];

export default function LayerPanel() {
  const store = useLayerStore();

  return (
    <div className="absolute top-12 left-2 w-48 bg-[#0a0f1a]/95 border border-gray-800/50 rounded-lg overflow-hidden z-10">
      {/* 레이어 토글 */}
      <div className="px-3 py-2 border-b border-gray-800/50">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Layers</p>
      </div>
      <div className="p-1.5 space-y-0.5">
        {LAYERS.map((l) => {
          const active = store[l.key as keyof typeof store] as boolean;
          return (
            <button
              key={l.key}
              onClick={() => store.toggleLayer(l.key)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
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
          );
        })}
      </div>

      {/* 수심 필터 */}
      <div className="px-3 py-2 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
          Depth Filter
        </p>
        <div className="space-y-0.5">
          {DEPTH_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => store.setDepthFilter(f.key)}
              className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors ${
                store.depthFilter === f.key
                  ? "bg-cyan-500/15 text-cyan-400"
                  : "text-gray-600 hover:bg-gray-800/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 베이스맵 */}
      <div className="px-3 py-2 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
          Basemap
        </p>
        <div className="flex gap-1">
          {([
            { key: "simple" as const, label: "일반" },
            { key: "satellite" as const, label: "위성" },
          ]).map((b) => (
            <button
              key={b.key}
              onClick={() => store.setBasemap(b.key)}
              className={`flex-1 px-2 py-1 rounded text-[11px] transition-colors ${
                store.basemap === b.key
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                  : "text-gray-600 hover:bg-gray-800/30 border border-transparent"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
