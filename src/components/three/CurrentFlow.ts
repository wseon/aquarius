import * as THREE from "three";
import { latLonToLocal } from "./coords";

export function createCurrentFlow(): THREE.Group {
  const group = new THREE.Group();
  group.name = "currentFlow";

  // 표층/중층/저층 해류
  const flowLayers = [
    { y: -5, speed: 1.2, dir: 340, color: 0xffffff, size: 4, label: "표층" },
    { y: -40, speed: 0.8, dir: 330, color: 0x67e8f9, size: 3, label: "중층" },
    { y: -80, speed: 0.4, dir: 320, color: 0x22d3ee, size: 2, label: "저층" },
  ];

  // 바다 영역 격자
  const CENTER = { lat: 37.496, lon: 126.605 };
  const RANGE = { dlat: 0.012, dlon: 0.015 };
  const STEP = 0.003;

  for (const layer of flowLayers) {
    const positions: number[] = [];

    for (let dlat = -RANGE.dlat; dlat <= RANGE.dlat; dlat += STEP) {
      for (let dlon = -RANGE.dlon; dlon <= RANGE.dlon; dlon += STEP) {
        const lat = CENTER.lat + dlat;
        const lon = CENTER.lon + dlon;
        if (lon > 126.627) continue; // 육지 제외

        const local = latLonToLocal(lat, lon, layer.y);
        positions.push(local.x, local.y, local.z);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: layer.color,
      size: layer.size,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.name = layer.label;
    group.add(points);
  }

  return group;
}
