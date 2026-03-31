"use client";

interface PierProps {
  position: [number, number, number];
  length: number;
}

export default function Pier({ position, length }: PierProps) {
  return (
    <group position={position}>
      {/* 안벽 본체 */}
      <mesh position={[0, 1.5, length / 2]} castShadow receiveShadow>
        <boxGeometry args={[6, 3, length]} />
        <meshStandardMaterial color="#2a3040" roughness={0.8} />
      </mesh>
      {/* 상단 가드레일 */}
      <mesh position={[0, 3.2, length / 2]}>
        <boxGeometry args={[6.5, 0.4, length]} />
        <meshStandardMaterial color="#3a4560" roughness={0.7} />
      </mesh>
      {/* 볼라드 (계선주) */}
      {Array.from({ length: Math.floor(length / 20) }).map((_, i) => (
        <mesh key={i} position={[-2, 3.5, i * 20 + 10]} castShadow>
          <cylinderGeometry args={[0.4, 0.5, 1, 8]} />
          <meshStandardMaterial color="#556677" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}
