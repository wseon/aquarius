"use client";

import { useEffect, useRef } from "react";

interface CurrentInfo {
  layer: string;
  speed: number;
  direction: number;
}

interface OceanInfoProps {
  info: {
    depth: number;
    currents: CurrentInfo[];
    x: number;
    y: number;
  };
}

const LAYER_COLORS: Record<string, string> = {
  "표층 (0-5m)": "#ffffff",
  "중층 (5-15m)": "#67e8f9",
  "저층 (15m+)": "#0891b2",
};

function dirToName(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export default function OceanInfoPopup({ info }: OceanInfoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - 15;

    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // 배경 원
      ctx.strokeStyle = "rgba(100,100,150,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.3, 0, Math.PI * 2);
      ctx.stroke();

      // 방위 표시
      ctx.fillStyle = "rgba(150,150,180,0.5)";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", cx, 12);
      ctx.fillText("S", cx, h - 4);
      ctx.fillText("E", w - 6, cy + 3);
      ctx.fillText("W", 8, cy + 3);

      // 중심점
      ctx.fillStyle = "rgba(100,150,255,0.5)";
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      // 수층별 해류 화살표 애니메이션
      for (let i = 0; i < info.currents.length; i++) {
        const c = info.currents[i];
        const color = LAYER_COLORS[c.layer] || "#ffffff";
        const rad = ((c.direction - 90) * Math.PI) / 180; // CSS 각도 → canvas 각도 (N=위)
        const arrowRad = ((c.direction) * Math.PI) / 180;

        // 유속에 비례한 길이 (최대 maxR)
        const len = Math.min(c.speed / 1.5, 1) * maxR * 0.85;

        // 파티클 위치 (시간에 따라 이동)
        const particleCount = 5;
        for (let p = 0; p < particleCount; p++) {
          const progress = ((time * c.speed * 0.5 + p / particleCount) % 1);
          const px = cx + Math.sin(arrowRad) * len * progress;
          const py = cy - Math.cos(arrowRad) * len * progress;
          const alpha = 1 - progress * 0.7;
          const size = 2.5 - progress * 1;

          ctx.fillStyle = color;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 화살표 머리
        const tipX = cx + Math.sin(arrowRad) * len;
        const tipY = cy - Math.cos(arrowRad) * len;
        const headLen = 8;
        const headAngle = 0.4;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(
          tipX - headLen * Math.sin(arrowRad - headAngle),
          tipY + headLen * Math.cos(arrowRad - headAngle)
        );
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(
          tipX - headLen * Math.sin(arrowRad + headAngle),
          tipY + headLen * Math.cos(arrowRad + headAngle)
        );
        ctx.stroke();

        // 라인
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      time += 0.02;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [info]);

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{ left: info.x + 12, top: info.y - 220 }}
    >
      <div className="bg-[#0a0f1a]/95 border border-blue-500/50 rounded-lg px-3 py-2 shadow-lg" style={{ width: 220 }}>
        <div className="flex items-center gap-2 mb-1 border-b border-gray-700/50 pb-1">
          <span className="text-xs font-bold text-blue-400">해양 정보</span>
          <span className="text-[9px] text-gray-500">수심 {info.depth}m</span>
        </div>

        {/* 애니메이션 캔버스 */}
        <canvas
          ref={canvasRef}
          width={194}
          height={140}
          style={{ display: "block", margin: "4px auto" }}
        />

        {/* 수치 정보 */}
        <div className="space-y-0.5 border-t border-gray-700/50 pt-1">
          {info.currents.map((c, i) => {
            const color = LAYER_COLORS[c.layer] || "#ffffff";
            return (
              <div key={i} className="flex items-center text-[10px] gap-1">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-400 flex-1">{c.layer}</span>
                <span className="text-white font-mono">{c.speed.toFixed(1)}</span>
                <span className="text-gray-500 text-[9px]">m/s</span>
                <span className="text-gray-300 font-mono w-10 text-right">{c.direction.toFixed(0)}°{dirToName(c.direction)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
