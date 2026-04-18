"use client";

import { useEffect, useState } from "react";

export default function Header() {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const tick = () => {
      setTimeStr(
        new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 h-10 bg-[#0a0f1a]/95 border-b border-gray-800/50 flex items-center px-4 z-10">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <h1 className="text-sm font-semibold text-white tracking-wide">
          부산항만 신항 해양관제 시스템
        </h1>
      </div>
      <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
        <span>SCADA 3D Maritime Monitoring</span>
        <span className="text-gray-400 font-mono">{timeStr}</span>
      </div>
    </div>
  );
}
