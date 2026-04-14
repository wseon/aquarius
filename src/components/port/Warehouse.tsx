"use client";

import { Html } from "@react-three/drei";

interface WarehouseProps {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  label: string;
}

export default function Warehouse({
  position,
  width,
  depth,
  height,
  label,
}: WarehouseProps) {
  return (
    <group position={position}>
      {/* 본체 */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#2a3345" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* 지붕 (약간 밝게) */}
      <mesh position={[0, height + 0.3, 0]}>
        <boxGeometry args={[width + 1, 0.6, depth + 1]} />
        <meshStandardMaterial color="#3a4560" roughness={0.7} />
      </mesh>
      {/* 셔터 문 */}
      {Array.from({ length: Math.floor(width / 8) }).map((_, i) => (
        <mesh
          key={i}
          position={[i * 8 - width / 2 + 6, 2.5, depth / 2 + 0.1]}
        >
          <planeGeometry args={[4, 5]} />
          <meshStandardMaterial color="#1a2535" roughness={0.9} />
        </mesh>
      ))}

      {/* 라벨 */}
      <Html position={[0, height + 3, 0]} center distanceFactor={200}>
        <div className="bg-[#0d1320]/90 border border-gray-600/40 rounded px-2 py-0.5 whitespace-nowrap pointer-events-none">
          <p className="text-[10px] text-gray-400">{label}</p>
        </div>
      </Html>
    </group>
  );
}
