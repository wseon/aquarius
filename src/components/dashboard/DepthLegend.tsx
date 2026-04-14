"use client";

export default function DepthLegend() {
  const levels = [
    { label: "0~5m", color: "bg-red-500", desc: "위험 (얕음)" },
    { label: "5~11m", color: "bg-orange-400", desc: "주의" },
    { label: "11~17m", color: "bg-yellow-400", desc: "보통" },
    { label: "17~22m", color: "bg-green-500", desc: "안전" },
    { label: "22~28m", color: "bg-cyan-400", desc: "심해" },
  ];

  return (
    <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur px-3 py-2 rounded-lg">
      <p className="text-xs font-bold mb-1">수심 범례</p>
      {levels.map((l) => (
        <div key={l.label} className="flex items-center gap-2 text-xs">
          <span className={`inline-block w-3 h-3 rounded-sm ${l.color}`} />
          <span className="text-gray-300">{l.label}</span>
          <span className="text-gray-500">{l.desc}</span>
        </div>
      ))}
    </div>
  );
}
