import * as THREE from "three";
import { latLonToLocal } from "./coords";

const MAX_DEPTH = 30;

function depthColor(depth: number): THREE.Color {
  const t = Math.min(Math.max(depth / MAX_DEPTH, 0), 1);
  // 얕은(밝은 청록) → 깊은(진한 남색), 높은 채도
  const r = 0.0 + (1 - t) * 0.15;
  const g = 0.85 - t * 0.55;
  const b = 0.95 - t * 0.25;
  return new THREE.Color(r, g, b);
}

export async function createBathymetryMesh(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = "bathymetry";

  const res = await fetch("/api/bathymetry-mesh");
  const data = await res.json();

  const { lats, lons, grid } = data;
  const depthScale = 8;

  const vertexMap = new Map<string, number>();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  function addVertex(i: number, j: number): number {
    const key = `${i},${j}`;
    if (vertexMap.has(key)) return vertexMap.get(key)!;

    const lat = lats[i];
    const lon = lons[j];
    const depth: number | undefined = grid[`${lat},${lon}`];
    if (depth == null) return -1;

    const idx = positions.length / 3;
    // 얕은 곳 = Y 높게, 깊은 곳 = Y 낮게
    // 해수면(Y=98) 바로 아래에서 시작, 깊을수록 아래로
    const local = latLonToLocal(lat, lon, 95 - depth * depthScale);
    positions.push(local.x, local.y, local.z);

    const color = depthColor(depth);
    colors.push(color.r, color.g, color.b);

    vertexMap.set(key, idx);
    return idx;
  }

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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // 메인 메시 (상면)
  // 메인 메시 — vertex color, 조명 없음, 균일 밝기
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);


  // 바운딩 박스 확인
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  console.log(`수심 메시: ${vertexMap.size}개 정점, ${indices.length / 3}개 삼각형`);
  console.log(`바운딩박스: min(${bb.min.x.toFixed(0)}, ${bb.min.y.toFixed(0)}, ${bb.min.z.toFixed(0)}) max(${bb.max.x.toFixed(0)}, ${bb.max.y.toFixed(0)}, ${bb.max.z.toFixed(0)})`);
  return group;
}
