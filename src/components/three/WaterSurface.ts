import * as THREE from "three";
import { latLonToLocal } from "./coords";

const WATER_Y = -21;

export function createWaterSurface(
  lats: number[],
  lons: number[],
  waterMap: Record<string, boolean>
): { mesh: THREE.Mesh; animate: () => void } {

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  function addVertex(i: number, j: number): number {
    const key = `${i},${j}`;
    if (vertexMap.has(key)) return vertexMap.get(key)!;

    const coordKey = `${lats[i]},${lons[j]}`;
    if (!waterMap[coordKey]) return -1;

    const idx = positions.length / 3;
    const local = latLonToLocal(lats[i], lons[j], WATER_Y);
    positions.push(local.x, local.y, local.z);
    colors.push(0.4, 0.75, 0.95); // 초기 색상

    vertexMap.set(key, idx);
    return idx;
  }

  for (let i = 0; i < lats.length - 1; i++) {
    for (let j = 0; j < lons.length - 1; j++) {
      const k00 = `${lats[i]},${lons[j]}`;
      const k10 = `${lats[i+1]},${lons[j]}`;
      const k01 = `${lats[i]},${lons[j+1]}`;
      const k11 = `${lats[i+1]},${lons[j+1]}`;

      if (!waterMap[k00] || !waterMap[k10] || !waterMap[k01] || !waterMap[k11]) continue;

      const v00 = addVertex(i, j);
      const v10 = addVertex(i + 1, j);
      const v01 = addVertex(i, j + 1);
      const v11 = addVertex(i + 1, j + 1);

      if (Math.min(v00, v10, v01, v11) < 0) continue;

      indices.push(v00, v01, v10);
      indices.push(v10, v01, v11);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "waterSurface";

  const origY = new Float32Array(positions.length / 3);
  for (let i = 0; i < origY.length; i++) {
    origY[i] = positions[i * 3 + 1];
  }

  let time = 0;

  const animate = () => {
    if (!mesh.visible) return;
    time += 0.005;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = geometry.getAttribute("color") as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const wave =
        Math.sin(x * 0.02 + time) * 1.5 +
        Math.sin(z * 0.015 + time * 0.8) * 1.2 +
        Math.sin((x + z) * 0.01 + time * 1.3) * 0.8 +
        Math.cos(x * 0.03 - time * 0.6) * 0.5;

      pos.setY(i, origY[i] + wave);

      // 파도 높이에 따라 색상 변화
      // 높은 곳(마루) = 밝은 하늘색, 낮은 곳(골) = 선명한 파랑
      const t = (wave + 4) / 8; // 0~1 정규화
      const r = 0.02 + t * 0.10;  // 0.02 ~ 0.12
      const g = 0.15 + t * 0.25;  // 0.15 ~ 0.40
      const b = 0.50 + t * 0.30;  // 0.50 ~ 0.80

      col.setXYZ(i, r, g, b);
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
  };

  return { mesh, animate };
}
