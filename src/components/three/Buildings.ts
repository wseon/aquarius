import * as THREE from "three";
import { latLonToLocal } from "./coords";

export async function createBuildings(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = "buildings";

  const res = await fetch("/api/buildings");
  const geojson = await res.json();

  // 건물별 색상 로드
  let colorMap: Record<string, number[]> = {};
  try {
    const colorRes = await fetch("/api/building-colors");
    colorMap = await colorRes.json();
  } catch {}

  const defaultMaterial = new THREE.MeshPhongMaterial({
    color: 0x6a7a8a,
    transparent: true,
    opacity: 0.9,
  });

  for (const feature of geojson.features) {
    const height = feature.properties.height || 8;
    const geomType = feature.geometry.type;

    const rings: number[][][] =
      geomType === "MultiPolygon"
        ? feature.geometry.coordinates.map((p: number[][][]) => p[0])
        : [feature.geometry.coordinates[0]];

    // 건물 중심 좌표로 색상 찾기
    const allCoords = rings[0] || [];
    const avgLat = allCoords.reduce((s: number, c: number[]) => s + (c[1] || 0), 0) / (allCoords.length || 1);
    const avgLon = allCoords.reduce((s: number, c: number[]) => s + (c[0] || 0), 0) / (allCoords.length || 1);
    const colorKey = `${avgLat.toFixed(5)},${avgLon.toFixed(5)}`;
    const rgb = colorMap[colorKey];

    const material = rgb
      ? new THREE.MeshPhongMaterial({
          color: new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255),
          transparent: true,
          opacity: 0.9,
        })
      : defaultMaterial;

    for (const ring of rings) {
      if (!ring || !Array.isArray(ring[0])) continue;

      // 2D shape
      const shape = new THREE.Shape();
      let first = true;
      for (const coord of ring) {
        if (typeof coord[0] !== "number" || typeof coord[1] !== "number") continue;
        const local = latLonToLocal(coord[1], coord[0], 0);
        if (first) {
          shape.moveTo(local.x, -local.z); // X, -Z → Shape(x, y)
          first = false;
        } else {
          shape.lineTo(local.x, -local.z);
        }
      }

      if (first) continue;

      try {
        const extrudeSettings = {
          depth: height * 3,
          bevelEnabled: false,
        };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mesh = new THREE.Mesh(geometry, material);
        // ExtrudeGeometry는 Z방향으로 돌출 → 회전해서 Y(위)방향으로
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0; // 육지면(Y=0) 위에 배치
        group.add(mesh);
      } catch {
        // 잘못된 geometry 스킵
      }
    }
  }

  return group;
}
