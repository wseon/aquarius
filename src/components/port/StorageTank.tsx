"use client";

import { Html } from "@react-three/drei";

interface StorageTankProps {
  position: [number, number, number];
  radius: number;
  height: number;
  label: string;
  volume: number;
  capacity: number;
}

export default function StorageTank({
  position,
  radius,
  height,
  label,
  volume,
  capacity,
}: StorageTankProps) {
  const fillRatio = volume / capacity;
  const fillColor =
    fillRatio > 0.7 ? "#22c55e" : fillRatio > 0.3 ? "#eab308" : "#ef4444";

  return (
    <group position={position}>
      {/* 탱크 외벽 */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, height, 24]} />
        <meshStandardMaterial
          color="#3a4555"
          metalness={0.5}
          roughness={0.4}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* 내용물 (채움 레벨) */}
      <mesh position={[0, (height * fillRatio) / 2, 0]}>
        <cylinderGeometry
          args={[radius - 0.3, radius - 0.3, height * fillRatio, 24]}
        />
        <meshStandardMaterial
          color={fillColor}
          transparent
          opacity={0.4}
          emissive={fillColor}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* 상단 뚜껑 */}
      <mesh position={[0, height + 0.1, 0]}>
        <cylinderGeometry args={[radius, radius, 0.2, 24]} />
        <meshStandardMaterial color="#4a5568" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* 파이프 */}
      <mesh position={[radius + 0.5, height * 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, height * 0.6, 8]} />
        <meshStandardMaterial color="#556677" metalness={0.6} />
      </mesh>

      {/* 라벨 */}
      <Html position={[0, height + 4, 0]} center distanceFactor={150}>
        <div className="bg-[#0d1320]/95 border border-gray-600/50 rounded px-2.5 py-1.5 text-center whitespace-nowrap pointer-events-none">
          <p className="text-[10px] text-gray-400">{label}</p>
          <p className="text-[14px] font-bold text-white">
            {volume}
            <span className="text-[10px] text-gray-500 ml-0.5">t</span>
          </p>
          {/* 바 게이지 */}
          <div className="w-16 h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${fillRatio * 100}%`,
                backgroundColor: fillColor,
              }}
            />
          </div>
        </div>
      </Html>
    </group>
  );
}
