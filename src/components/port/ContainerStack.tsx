"use client";

import * as THREE from "three";
import { useMemo } from "react";

interface ContainerStackProps {
  position: [number, number, number];
  rows: number;
  cols: number;
  layers: number;
  color?: string;
}

export default function ContainerStack({
  position,
  rows,
  cols,
  layers,
  color = "#2563eb",
}: ContainerStackProps) {
  const containers = useMemo(() => {
    const items: { pos: [number, number, number]; color: string }[] = [];
    const cw = 6, ch = 2.6, cd = 2.5; // 컨테이너 크기
    const gap = 0.15;
    const colors = [color, "#1e40af", "#0e7490", "#047857", "#b45309"];

    for (let layer = 0; layer < layers; layer++) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // 랜덤하게 일부 비어있게
          if (layer > 0 && Math.random() > 0.8) continue;
          items.push({
            pos: [
              col * (cw + gap) - (cols * cw) / 2,
              layer * (ch + gap) + ch / 2,
              row * (cd + gap) - (rows * cd) / 2,
            ],
            color: colors[(col + layer) % colors.length],
          });
        }
      }
    }
    return items;
  }, [rows, cols, layers, color]);

  return (
    <group position={position}>
      {containers.map((c, i) => (
        <mesh key={i} position={c.pos} castShadow>
          <boxGeometry args={[5.8, 2.4, 2.3]} />
          <meshStandardMaterial
            color={c.color}
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}
