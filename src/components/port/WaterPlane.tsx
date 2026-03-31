"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function WaterPlane() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.15 - 0.5;
    }
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[-80, -0.5, 0]}>
      <planeGeometry args={[150, 300]} />
      <meshStandardMaterial
        color="#0c2d48"
        transparent
        opacity={0.7}
        roughness={0.2}
        metalness={0.3}
      />
    </mesh>
  );
}
