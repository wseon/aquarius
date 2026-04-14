"use client";

import { useEffect, useRef } from "react";

// 전역 heading ref (ThreeMapView에서 업데이트)
export const compassHeadingRef = { current: 0 };

export default function Compass() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;

    const draw = () => {
      const heading = compassHeadingRef.current;

      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-heading);

      // 외곽 원
      ctx.strokeStyle = "rgba(100,120,150,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // 내부 원
      ctx.strokeStyle = "rgba(80,100,130,0.2)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      // N 화살표 (빨강)
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(0, -r + 2);
      ctx.lineTo(-6, -r + 18);
      ctx.lineTo(0, -r + 14);
      ctx.lineTo(6, -r + 18);
      ctx.closePath();
      ctx.fill();

      // S 화살표 (하양)
      ctx.fillStyle = "rgba(200,200,210,0.6)";
      ctx.beginPath();
      ctx.moveTo(0, r - 2);
      ctx.lineTo(-5, r - 16);
      ctx.lineTo(0, r - 12);
      ctx.lineTo(5, r - 16);
      ctx.closePath();
      ctx.fill();

      // 방위 글자
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "#ef4444";
      ctx.fillText("N", 0, -r + 26);

      ctx.fillStyle = "rgba(180,180,190,0.6)";
      ctx.fillText("S", 0, r - 24);
      ctx.fillText("E", r - 18, 0);
      ctx.fillText("W", -r + 18, 0);

      // 눈금선 (30도 간격)
      for (let deg = 0; deg < 360; deg += 30) {
        const rad = (deg * Math.PI) / 180;
        const inner = deg % 90 === 0 ? r * 0.75 : r * 0.85;
        ctx.strokeStyle = deg % 90 === 0 ? "rgba(150,160,180,0.5)" : "rgba(100,110,130,0.3)";
        ctx.lineWidth = deg % 90 === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.sin(rad) * inner, -Math.cos(rad) * inner);
        ctx.lineTo(Math.sin(rad) * (r - 2), -Math.cos(rad) * (r - 2));
        ctx.stroke();
      }

      ctx.restore();

      // 중심점
      ctx.fillStyle = "rgba(200,210,230,0.8)";
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="absolute bottom-20 left-4 z-10">
      <canvas
        ref={canvasRef}
        width={80}
        height={80}
        style={{ opacity: 0.9 }}
      />
    </div>
  );
}
