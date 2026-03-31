"use client";

import { Html } from "@react-three/drei";

interface CraneProps {
  position: [number, number, number];
  label: string;
  status: string;
}

export default function Crane({ position, label, status }: CraneProps) {
  const statusColor =
    status === "운행중" ? "#22c55e" : status === "대기" ? "#eab308" : "#ef4444";

  return (
    <group position={position}>
      {/* 좌측 다리 */}
      <mesh position={[-5, 15, 0]} castShadow>
        <boxGeometry args={[1.2, 30, 1.2]} />
        <meshStandardMaterial color="#e87730" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 우측 다리 */}
      <mesh position={[5, 15, 0]} castShadow>
        <boxGeometry args={[1.2, 30, 1.2]} />
        <meshStandardMaterial color="#e87730" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 상단 가로빔 */}
      <mesh position={[0, 31, 0]} castShadow>
        <boxGeometry args={[14, 2, 1.5]} />
        <meshStandardMaterial color="#e87730" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 붐 (바다쪽으로 돌출) */}
      <mesh position={[-12, 32, 0]} castShadow>
        <boxGeometry args={[20, 1.5, 1.2]} />
        <meshStandardMaterial color="#e87730" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 기계실 */}
      <mesh position={[3, 33, 0]} castShadow>
        <boxGeometry args={[5, 4, 3]} />
        <meshStandardMaterial color="#cc6020" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* 하단 레일 */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[14, 0.6, 1]} />
        <meshStandardMaterial color="#445566" metalness={0.5} />
      </mesh>

      {/* 라벨 */}
      <Html position={[0, 38, 0]} center distanceFactor={150}>
        <div className="bg-[#0d1320]/95 border border-gray-600/50 rounded px-2 py-1 text-center whitespace-nowrap pointer-events-none">
          <p className="text-[10px] text-gray-400">{label}</p>
          <p className="text-[11px] font-bold" style={{ color: statusColor }}>
            {status}
          </p>
        </div>
      </Html>
    </group>
  );
}
