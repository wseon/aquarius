import * as THREE from "three";
import { latLonToLocal } from "./coords";

const POLLUTION_Y = -16;

export function createPollution(): { group: THREE.Group; animate: () => void } {
  const group = new THREE.Group();
  group.name = "pollution";

  // 오염원 위치
  const source = latLonToLocal(37.497, 126.615, POLLUTION_Y);
  const MAX_RADIUS = 300;
  const PARTICLE_COUNT = 500;

  // 파티클 초기 위치 (오염원 중심)
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const speeds = new Float32Array(PARTICLE_COUNT);
  const angles = new Float32Array(PARTICLE_COUNT);
  const distances = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    angles[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.3 + Math.random() * 0.7;
    distances[i] = Math.random() * MAX_RADIUS * 0.1; // 처음엔 중심에 모여있음

    positions[i * 3] = source.x + Math.cos(angles[i]) * distances[i];
    positions[i * 3 + 1] = POLLUTION_Y + (Math.random() - 0.5) * 3;
    positions[i * 3 + 2] = source.z + Math.sin(angles[i]) * distances[i];

    // 초기 색상 (빨간 → 주황 그라데이션)
    colors[i * 3] = 0.7;
    colors[i * 3 + 1] = 0.1;
    colors[i * 3 + 2] = 0.05;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    vertexColors: true,
    size: 6,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  group.add(points);

  // 오염원 마커 (빨간 구)
  const markerGeo = new THREE.SphereGeometry(5, 16, 16);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.set(source.x, POLLUTION_Y + 10, source.z);
  group.add(marker);

  // 라벨
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ff3333";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("⚠ 유류 유출 지점", 256, 45);
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(source.x, POLLUTION_Y + 35, source.z);
  sprite.scale.set(120, 15, 1);
  group.add(sprite);

  let time = 0;

  const animate = () => {
    if (!group.visible) return;
    time += 0.01;

    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = geometry.getAttribute("color") as THREE.BufferAttribute;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 확산: 거리 증가
      distances[i] += speeds[i] * 0.3;

      // 최대 반경 도달 시 리셋 (중심에서 다시)
      if (distances[i] > MAX_RADIUS) {
        distances[i] = Math.random() * 10;
        angles[i] = Math.random() * Math.PI * 2;
      }

      // 약간의 각도 변동 (자연스러운 확산)
      angles[i] += (Math.random() - 0.5) * 0.02;

      // 해류 영향 (조금씩 북서 방향으로 밀림)
      const drift = time * 0.3;

      pos.setX(i, source.x + Math.cos(angles[i]) * distances[i] + drift * 0.5);
      pos.setZ(i, source.z + Math.sin(angles[i]) * distances[i] - drift * 0.3);

      // 거리에 따라 색상 변화: 가까이=진한빨강, 멀리=연한주황
      const t = distances[i] / MAX_RADIUS;
      col.setXYZ(i,
        0.7 + t * 0.2,           // R: 0.7 → 0.9
        0.1 + t * 0.4,           // G: 0.1 → 0.5
        0.05 + t * 0.1            // B: 0.05 → 0.15
      );
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;

    // 마커 펄스
    marker.scale.setScalar(1 + Math.sin(time * 5) * 0.2);
  };

  return { group, animate };
}
