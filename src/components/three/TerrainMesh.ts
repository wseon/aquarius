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

  const mesh = new THREE.Mesh(geometry, material);

  // 해저지형 와이어프레임 격자선
  if (mode === "seabed") {
    const wireMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const wireMesh = new THREE.Mesh(geometry, wireMat);
    wireMesh.position.y = 0.1; // 약간 위에 겹침 방지
    mesh.add(wireMesh);
  }

  // 육지 경계 엣지 라인 (각도 15도 이상 꺾이는 곳만)
  const edgeGeo = new THREE.EdgesGeometry(geometry, 7);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x444444,
    transparent: true,
    opacity: 0.5,
  });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  mesh.add(edges);

  return mesh;
}

export async function createTerrainMesh(): Promise<{ seabedMesh: THREE.Group; surfaceMesh: THREE.Group; animateSurface: () => void }> {
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
  const surfaceMeshObj = buildUnifiedMesh(lats, lons, waterMap, null, "surface");
  surfaceGroup.add(surfaceMeshObj);

  // 파도 애니메이션용 — 바다 정점 인덱스 기록
  const surfaceGeo = surfaceMeshObj.geometry;
  const posAttr = surfaceGeo.getAttribute("position") as THREE.BufferAttribute;
  const colAttr = surfaceGeo.getAttribute("color") as THREE.BufferAttribute;
  const vertCount = posAttr.count;

  // 원본 Y, 바다 여부 기록
  const origY = new Float32Array(vertCount);
  const isWaterVert = new Uint8Array(vertCount);
  for (let i = 0; i < vertCount; i++) {
    origY[i] = posAttr.getY(i);
    // 육지 Y=0, 바다 Y=WATER_SURFACE_Y(-21) — Y < -5이면 바다
    isWaterVert[i] = posAttr.getY(i) < -5 ? 1 : 0;
  }

  let time = 0;
  const animateSurface = () => {
    if (!surfaceGroup.visible) return;
    time += 0.008;

    for (let i = 0; i < vertCount; i++) {
      if (!isWaterVert[i]) continue;

      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);

      // 다중 주파수 파도
      const wave1 = Math.sin(x * 0.015 + time * 1.0) * 1.8;
      const wave2 = Math.sin(z * 0.012 + time * 0.7) * 1.4;
      const wave3 = Math.sin((x + z) * 0.008 + time * 1.5) * 1.0;
      const wave4 = Math.cos(x * 0.025 - time * 0.5) * 0.6;
      const wave5 = Math.sin(x * 0.04 + z * 0.03 + time * 2.0) * 0.4;
      const wave = wave1 + wave2 + wave3 + wave4 + wave5;

      posAttr.setY(i, origY[i] + wave);

      // 파도 높이별 색상 (진한 파랑 ~ 밝은 청록)
      const t = (wave + 5) / 10; // 0~1
      const r = 0.02 + t * 0.10;
      const g = 0.15 + t * 0.25;
      const b = 0.50 + t * 0.30;
      colAttr.setXYZ(i, r, g, b);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  console.log(`지형 메시: 통합(seabed) + 통합(surface+파도) 생성 완료`);
  return { seabedMesh: seabedGroup, surfaceMesh: surfaceGroup, animateSurface };
}
