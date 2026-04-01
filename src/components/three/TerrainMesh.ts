import * as THREE from "three";
import { latLonToLocal } from "./coords";

const MAX_DEPTH = 30;
const DEPTH_SCALE = 5;
const LAND_Y = 0;
const DEFAULT_SEA_Y = -20;
const WATER_SURFACE_Y = -21;
const LAND_COLOR = new THREE.Color(0.88, 0.88, 0.85);

function seaColor(depth: number): THREE.Color {
  const t = Math.min(Math.max(depth / MAX_DEPTH, 0), 1);
  let r: number, g: number, b: number;
  if (t < 0.17) {
    const s = t / 0.17;
    r = 0.80 - s * 0.47; g = 0.53 + s * 0.33; b = 0.20 - s * 0.03;
  } else if (t < 0.33) {
    const s = (t - 0.17) / 0.16;
    r = 0.33 - s * 0.06; g = 0.86 - s * 0.13; b = 0.17 + s * 0.10;
  } else if (t < 0.50) {
    const s = (t - 0.33) / 0.17;
    r = 0.27 - s * 0.14; g = 0.73 + s * 0.07; b = 0.27 + s * 0.53;
  } else if (t < 0.67) {
    const s = (t - 0.50) / 0.17;
    r = 0.13 + s * 0.07; g = 0.80 - s * 0.40; b = 0.80;
  } else {
    const s = (t - 0.67) / 0.33;
    r = 0.20 - s * 0.10; g = 0.40 - s * 0.33; b = 0.80 - s * 0.37;
  }
  return new THREE.Color(r, g, b);
}

function buildUnifiedMesh(
  lats: number[], lons: number[],
  waterMap: Record<string, boolean>,
  depthMap: Record<string, number> | null,
  mode: "seabed" | "surface"
): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  const SURFACE_COLOR = new THREE.Color(0.04, 0.20, 0.55);

  function addVertex(i: number, j: number): number {
    const key = `${i},${j}`;
    if (vertexMap.has(key)) return vertexMap.get(key)!;

    const idx = positions.length / 3;
    const coordKey = `${lats[i]},${lons[j]}`;
    const water = waterMap[coordKey] === true;

    let y: number;
    let color: THREE.Color;

    if (water) {
      if (mode === "seabed") {
        const depth = depthMap?.[coordKey];
        if (depth != null) {
          y = -depth * DEPTH_SCALE;
          color = seaColor(depth);
        } else {
          y = DEFAULT_SEA_Y;
          color = seaColor(15);
        }
      } else {
        // surface 모드: 평면 해수면
        y = WATER_SURFACE_Y;
        color = SURFACE_COLOR;
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

      if (Math.min(v00, v10, v01, v11) < 0) continue;

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

  return new THREE.Mesh(geometry, material);
}

export async function createTerrainMesh(): Promise<{ seabedMesh: THREE.Group; surfaceMesh: THREE.Group }> {
  const res = await fetch("/api/terrain-watermap");
  const data = await res.json();
  const { lats, lons, waterMap, depthMap } = data;

  // 1. 육지 + 해저지형
  const seabedGroup = new THREE.Group();
  seabedGroup.name = "seabedTerrain";
  seabedGroup.add(buildUnifiedMesh(lats, lons, waterMap, depthMap, "seabed"));

  // 2. 육지 + 해수면
  const surfaceGroup = new THREE.Group();
  surfaceGroup.name = "surfaceTerrain";
  surfaceGroup.add(buildUnifiedMesh(lats, lons, waterMap, null, "surface"));

  console.log(`지형 메시: 통합(seabed) + 통합(surface) 생성 완료`);
  return { seabedMesh: seabedGroup, surfaceMesh: surfaceGroup };
}
