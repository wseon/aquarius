import * as THREE from "three";

// 중심점 (ROI 중심)
export const CENTER = { lat: 35.45288, lon: 129.36385 };

// 위경도 → 로컬 미터 좌표 (Three.js: X=동, Y=위, Z=-북)
export function latLonToLocal(lat: number, lon: number, height: number = 0): THREE.Vector3 {
  const x = (lon - CENTER.lon) * 88000;
  const z = -(lat - CENTER.lat) * 111000;
  return new THREE.Vector3(x, height, z);
}
