"use client";

import { useEffect, useState } from "react";
import { useLayerStore } from "@/stores/layerStore";

export default function TimeSlider() {
  const { timeHour, setTimeHour } = useLayerStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#0a0f1a]/95 border border-gray-800/50 rounded-lg px-4 py-2 flex items-center gap-3 z-10">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider w-8">
        {String(timeHour).padStart(2, "0")}:00
      </span>
      <input
        type="range"
        min={0}
        max={23}
        value={timeHour}
        onChange={(e) => setTimeHour(Number(e.target.value))}
        className="w-64 h-1 appearance-none bg-gray-800 rounded-full cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-cyan-400
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex gap-1 text-[9px] text-gray-600">
        <span>과거</span>
        <span>—</span>
        <span className="text-cyan-500">현재</span>
        <span>—</span>
        <span>예측</span>
      </div>
    </div>
  );
}
