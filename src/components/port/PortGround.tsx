"use client";

export default function PortGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[30, -0.05, 20]} receiveShadow>
      <planeGeometry args={[250, 200]} />
      <meshStandardMaterial color="#1a1f2e" roughness={0.9} />
    </mesh>
  );
}
