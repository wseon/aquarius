import * as THREE from "three";
import { latLonToLocal } from "./coords";

const MAX_DEPTH = 30;
const DEPTH_SCALE = 5;

function seaColor(depth: number): THREE.Color {
  const t = Math.min(Math.max(depth / MAX_DEPTH, 0), 1);

  let r: number, g: number, b: number;

  if (t < 0.17) {
    // 0~5m: 주황 → 연두
    const s = t / 0.17;
    r = 0.80 - s * 0.47; g = 0.53 + s * 0.33; b = 0.20 - s * 0.03;
  } else if (t < 0.33) {
    // 5~10m: 연두 → 초록
    const s = (t - 0.17) / 0.16;
    r = 0.33 - s * 0.06; g = 0.86 - s * 0.13; b = 0.17 + s * 0.10;
  } else if (t < 0.50) {
    // 10~15m: 초록 → 청록
    const s = (t - 0.33) / 0.17;
    r = 0.27 - s * 0.14; g = 0.73 + s * 0.07; b = 0.27 + s * 0.53;
  } else if (t < 0.67) {
    // 15~20m: 청록 → 파랑
    const s = (t - 0.50) / 0.17;
    r = 0.13 + s * 0.07; g = 0.80 - s * 0.40; b = 0.80 - s * 0.0;
  } else {
    // 20~30m: 파랑 → 진한 남색
    const s = (t - 0.67) / 0.33;
    r = 0.20 - s * 0.10; g = 0.40 - s * 0.33; b = 0.80 - s * 0.37;
  }

  return new THREE.Color(r, g, b);
}

export async function createTerrainMesh(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = "terrain";

  const res = await fetch("/api/terrain-watermap");
  const data = await res.json();
  const { lats, lons, waterMap, depthMap } = data;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  const LAND_Y = 0;
  const DEFAULT_SEA_Y = -20;
  const LAND_COLOR = new THREE.Color(0.88, 0.88, 0.85);

  function addVertex(i: number, j: number): number {
    const key = `${i},${j}`;
    if (vertexMap.has(key)) return vertexMap.get(key)!;

    const idx = positions.length / 3;
    const coordKey = `${lats[i]},${lons[j]}`;
    const water = waterMap[coordKey] === true;

    let y: number;
    let color: THREE.Color;

    if (water) {
      const depth = depthMap?.[coordKey];
      if (depth != null) {
        y = -depth * DEPTH_SCALE;
        color = seaColor(depth);
      } else {
        y = DEFAULT_SEA_Y;
        color = seaColor(15);
      }
    } else {
      y = LAND_Y;
      color = LAND_COLOR;
    }

    const local = latLonToLocal(lats[i], lons[j], y);
    positions.push(local.x, local.y, local.z);
    colors.push(color.r, color.g, color.b);

    vertexMap.set(key, idx);
    return idx;
  }

  for (let i = 0; i < lats.length - 1; i++) {
    for (let j = 0; j < lons.length - 1; j++) {
      const v00 = addVertex(i, j);
      const v10 = addVertex(i + 1, j);
      const v01 = addVertex(i, j + 1);
      const v11 = addVertex(i + 1, j + 1);

      indices.push(v00, v01, v10);
      indices.push(v10, v01, v11);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  console.log(`지형 메시: ${vertexMap.size}개 정점, ${indices.length / 3}개 삼각형`);
  return group;
}
