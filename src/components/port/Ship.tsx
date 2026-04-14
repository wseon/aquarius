"use client";

import { Html } from "@react-three/drei";

interface ShipProps {
  position: [number, number, number];
  length: number;
  label: string;
  status: string;
}

export default function Ship({ position, length, label, status }: ShipProps) {
  const w = length * 0.18;
  const h = length * 0.08;
  const statusColor = status === "하역중" ? "#22c55e" : "#eab308";

  return (
    <group position={position}>
      {/* 선체 */}
      <mesh position={[0, h / 2 - 1, 0]} castShadow>
        <boxGeometry args={[w, h, length]} />
        <meshStandardMaterial color="#2d3748" roughness={0.7} metalness={0.2} />
      </mesh>
      {/* 선교 (브릿지) */}
      <mesh position={[0, h + 3, -length * 0.35]} castShadow>
        <boxGeometry args={[w * 0.6, 7, length * 0.1]} />
        <meshStandardMaterial color="#374151" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* 굴뚝 */}
      <mesh position={[0, h + 8, -length * 0.35]} castShadow>
        <boxGeometry args={[2, 4, 2]} />
        <meshStandardMaterial color="#dc2626" roughness={0.7} />
      </mesh>
      {/* 컨테이너 적재 */}
      <mesh position={[0, h + 2, length * 0.1]}>
        <boxGeometry args={[w - 2, 5, length * 0.5]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.8} />
      </mesh>
      {/* 선수 (앞) */}
      <mesh position={[0, h / 2 - 2, length * 0.48]} castShadow>
        <boxGeometry args={[w * 0.6, h * 0.7, length * 0.08]} />
        <meshStandardMaterial color="#2d3748" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* 라벨 */}
      <Html position={[0, h + 14, 0]} center distanceFactor={200}>
        <div className="bg-[#0d1320]/95 border border-gray-600/50 rounded px-2.5 py-1 text-center whitespace-nowrap pointer-events-none">
          <p className="text-[10px] text-gray-400">{label}</p>
          <p className="text-[11px] font-bold" style={{ color: statusColor }}>
            ● {status}
          </p>
        </div>
      </Html>
    </group>
  );
}
