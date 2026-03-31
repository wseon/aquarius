"use client";

import { useLayerStore } from "@/stores/layerStore";

const LAYERS = [
  { key: "facilities", label: "항만시설", icon: "⊞" },
  { key: "grid", label: "격자", icon: "▤" },
];

export default function LayerPanel() {
  const store = useLayerStore();

  return (
    <div className="absolute top-12 left-2 w-48 bg-[#0a0f1a]/95 border border-gray-800/50 rounded-lg overflow-hidden z-10">
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
    </div>
  );
}
