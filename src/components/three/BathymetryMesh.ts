import * as THREE from "three";
import { latLonToLocal } from "./ThreeOverlay";

const MAX_DEPTH = 30;

function depthColor(depth: number): THREE.Color {
  const t = Math.min(Math.max(depth / MAX_DEPTH, 0), 1);
  let r: number, g: number, b: number;
  if (t < 0.15) {
    r = 0.9; g = 0.6 + (t / 0.15) * 0.15; b = 0.2;
  } else if (t < 0.35) {
    const s = (t - 0.15) / 0.2;
    r = 0.9 - s * 0.6; g = 0.75 + s * 0.15; b = 0.2 + s * 0.1;
  } else if (t < 0.55) {
    const s = (t - 0.35) / 0.2;
    r = 0.3 - s * 0.2; g = 0.9 - s * 0.1; b = 0.3 + s * 0.4;
  } else if (t < 0.75) {
    const s = (t - 0.55) / 0.2;
    r = 0.1 - s * 0.05; g = 0.8 - s * 0.4; b = 0.7 + s * 0.15;
  } else {
    const s = (t - 0.75) / 0.25;
    r = 0.05; g = 0.4 - s * 0.25; b = 0.85 - s * 0.15;
  }
  return new THREE.Color(r, g, b);
}

export async function createBathymetryMesh(): Promise<THREE.Mesh> {
  const res = await fetch("/api/bathymetry-mesh");
  const data = await res.json();

  const { lats, lons, grid } = data;
  const depthScale = 10;

  // 정점 인덱스 맵
  const vertexMap = new Map<string, number>();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const maxD = Math.max(...Object.values(grid) as number[]);

  function addVertex(i: number, j: number): number {
    const key = `${i},${j}`;
    if (vertexMap.has(key)) return vertexMap.get(key)!;

    const lat = lats[i];
    const lon = lons[j];
    const depth: number | undefined = grid[`${lat},${lon}`];
    if (depth == null) return -1;

    const idx = positions.length / 3;
    const local = latLonToLocal(lat, lon, -depth * depthScale);
    positions.push(local.x, local.y, local.z);

    const color = depthColor(depth);
    colors.push(color.r, color.g, color.b);

    vertexMap.set(key, idx);
    return idx;
  }

  // 삼각형 생성
  for (let i = 0; i < lats.length - 1; i++) {
    for (let j = 0; j < lons.length - 1; j++) {
      if (lats[i + 1] - lats[i] > 0.0004) continue;
      if (lons[j + 1] - lons[j] > 0.0005) continue;

      const has = [i, i + 1].every((ii) =>
        [j, j + 1].every((jj) => grid[`${lats[ii]},${lons[jj]}`] != null)
      );
      if (!has) continue;

      const v00 = addVertex(i, j);
      const v10 = addVertex(i + 1, j);
      const v01 = addVertex(i, j + 1);
      const v11 = addVertex(i + 1, j + 1);

      if (Math.min(v00, v10, v01, v11) < 0) continue;

      indices.push(v00, v01, v10);
      indices.push(v10, v01, v11);
    }
  }

  // BufferGeometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    shininess: 30,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "bathymetry";
  return mesh;
}
