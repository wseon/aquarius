import * as THREE from "three";

const MARINE_Y = -14;
const AIR_BASE_Y = 10;
const MAX_RADIUS = 350;
const MARINE_PARTICLES = 800;
const AIR_PARTICLES = 400;

type PollutionType = "marine" | "air";

interface CurrentData {
  speed: number;
  direction: number; // degrees
}

interface PollutionSource {
  type: PollutionType;
  position: THREE.Vector3;
  particles: THREE.Points;
  distances: Float32Array;
  angles: Float32Array;
  speeds: Float32Array;
  heights: Float32Array;
  marker: THREE.Mesh;
  label: THREE.Sprite;
  current: CurrentData; // 해류 방향/속도
}

export class PollutionSystem {
  group: THREE.Group;
  private sources: PollutionSource[] = [];
  private time = 0;
  private currentVectors: { speed: number; direction: number }[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = "pollution";
  }

  // 해류 데이터 로드
  async loadCurrentData(hour: number = 12) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/current-vectors`);
      const data = await res.json();
      const vectors = data.hours?.[String(hour)] || data.hours?.["12"] || [];
      this.currentVectors = vectors
        .filter((v: any) => v.layer === "surface")
        .map((v: any) => ({ speed: v.speed, direction: v.direction }));
    } catch {}
  }

  // 주어진 위치에서 가장 가까운 해류 벡터 찾기
  private getNearestCurrent(pos: THREE.Vector3): CurrentData {
    if (this.currentVectors.length === 0) {
      return { speed: 0.5, direction: 340 }; // 기본값
    }
    // 평균 해류 사용 (단순화)
    const avgSpeed = this.currentVectors.reduce((s, v) => s + v.speed, 0) / this.currentVectors.length;
    const avgDir = this.currentVectors[0].direction; // 대표 방향
    return { speed: avgSpeed, direction: avgDir };
  }

  addMarineSource(position: THREE.Vector3, name?: string) {
    const current = this.getNearestCurrent(position);
    const src = this.createSource("marine", position, name || `해양오염 ${this.getCount("marine") + 1}`, current);
    this.sources.push(src);
    return this.sources.length;
  }

  addAirSource(position: THREE.Vector3, name?: string) {
    const src = this.createSource("air", position, name || `대기오염 ${this.getCount("air") + 1}`, { speed: 0, direction: 0 });
    this.sources.push(src);
    return this.sources.length;
  }

  getCount(type?: PollutionType) {
    if (!type) return this.sources.length;
    return this.sources.filter(s => s.type === type).length;
  }

  removeAll() {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.sources = [];
  }

  private createSource(type: PollutionType, pos: THREE.Vector3, name: string, current: CurrentData): PollutionSource {
    const isMarine = type === "marine";
    const baseY = isMarine ? MARINE_Y : pos.y + AIR_BASE_Y;
    const sourcePos = new THREE.Vector3(pos.x, baseY, pos.z);
    const particleCount = isMarine ? MARINE_PARTICLES : AIR_PARTICLES;

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const distances = new Float32Array(particleCount);
    const angles = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const heights = new Float32Array(particleCount);

    // 해류 방향 (라디안)
    const flowRad = (current.direction * Math.PI) / 180;
    const flowDx = Math.sin(flowRad);
    const flowDz = -Math.cos(flowRad);

    for (let i = 0; i < particleCount; i++) {
      if (isMarine) {
        // 해류 방향 기반 초기 각도 (해류 방향 ±60도 범위에 집중)
        const baseAngle = flowRad + (Math.random() - 0.5) * Math.PI * 0.7;
        angles[i] = baseAngle;
      } else {
        angles[i] = Math.random() * Math.PI * 2;
      }
      speeds[i] = 0.2 + Math.random() * 0.6;
      distances[i] = Math.random() * (isMarine ? MAX_RADIUS * 0.05 : 10);
      heights[i] = Math.random() * 5;

      if (isMarine) {
        positions[i * 3] = sourcePos.x + Math.sin(angles[i]) * distances[i];
        positions[i * 3 + 1] = baseY + (Math.random() - 0.5) * 2;
        positions[i * 3 + 2] = sourcePos.z - Math.cos(angles[i]) * distances[i];
        // 진한 빨강/갈색
        colors[i * 3] = 0.6 + Math.random() * 0.2;
        colors[i * 3 + 1] = 0.05 + Math.random() * 0.1;
        colors[i * 3 + 2] = 0.02 + Math.random() * 0.05;
      } else {
        positions[i * 3] = sourcePos.x + (Math.random() - 0.5) * 8;
        positions[i * 3 + 1] = baseY + heights[i];
        positions[i * 3 + 2] = sourcePos.z + (Math.random() - 0.5) * 8;
        colors[i * 3] = 0.9 + Math.random() * 0.1;
        colors[i * 3 + 1] = 0.5 + Math.random() * 0.3;
        colors[i * 3 + 2] = 0.1 + Math.random() * 0.1;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: isMarine ? 7 : 6,
      transparent: true,
      opacity: isMarine ? 0.85 : 0.8,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    this.group.add(particles);

    // 마커
    const markerColor = isMarine ? 0xff0000 : 0xffaa00;
    const markerGeo = new THREE.SphereGeometry(isMarine ? 5 : 3, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: markerColor });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(sourcePos.x, baseY + (isMarine ? 12 : 20), sourcePos.z);
    this.group.add(marker);

    // 라벨
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = isMarine ? "#ff3333" : "#ffaa33";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`⚠ ${name}`, 512, 90);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const label = new THREE.Sprite(spriteMat);
    label.position.set(sourcePos.x, baseY + (isMarine ? 45 : 60), sourcePos.z);
    label.scale.set(400, 48, 1);
    this.group.add(label);

    return { type, position: sourcePos, particles, distances, angles, speeds, heights, marker, label, current };
  }

  animate() {
    if (!this.group.visible || this.sources.length === 0) return;
    this.time += 0.01;

    for (const src of this.sources) {
      const pos = src.particles.geometry.getAttribute("position") as THREE.BufferAttribute;
      const col = src.particles.geometry.getAttribute("color") as THREE.BufferAttribute;
      const particleCount = pos.count;

      if (src.type === "marine") {
        // 해류 방향에 맞춰 확산
        const flowRad = (src.current.direction * Math.PI) / 180;
        const flowSpeed = src.current.speed * 0.4;
        const flowDx = Math.sin(flowRad) * flowSpeed;
        const flowDz = -Math.cos(flowRad) * flowSpeed;

        for (let i = 0; i < particleCount; i++) {
          src.distances[i] += src.speeds[i] * 0.25;

          if (src.distances[i] > MAX_RADIUS) {
            src.distances[i] = Math.random() * 8;
            // 리셋 시 해류 방향 기반 각도
            src.angles[i] = flowRad + (Math.random() - 0.5) * Math.PI * 0.7;
          }

          // 약간의 각도 변동
          src.angles[i] += (Math.random() - 0.5) * 0.015;

          // 자체 확산 (해류 방향 좌표계) + 해류 드리프트
          const selfX = Math.sin(src.angles[i]) * src.distances[i];
          const selfZ = -Math.cos(src.angles[i]) * src.distances[i];
          const driftX = flowDx * src.distances[i] * 0.8;
          const driftZ = flowDz * src.distances[i] * 0.8;

          pos.setX(i, src.position.x + selfX + driftX);
          pos.setZ(i, src.position.z + selfZ + driftZ);

          // 거리에 따라 색상 변화 (진한빨강 → 연한갈색)
          const t = src.distances[i] / MAX_RADIUS;
          col.setXYZ(i,
            0.6 + t * 0.25,
            0.05 + t * 0.25,
            0.02 + t * 0.08
          );
        }
      } else {
        // 대기: 위로 올라가면서 퍼짐
        for (let i = 0; i < particleCount; i++) {
          src.heights[i] += src.speeds[i] * 0.8;
          src.distances[i] += src.speeds[i] * 0.15;
          src.angles[i] += (Math.random() - 0.5) * 0.03;

          const windX = Math.sin(this.time * 0.5) * 0.2;
          const windZ = Math.cos(this.time * 0.3) * 0.15;

          if (src.heights[i] > 200) {
            src.heights[i] = Math.random() * 3;
            src.distances[i] = Math.random() * 3;
            src.angles[i] = Math.random() * Math.PI * 2;
          }

          pos.setX(i, src.position.x + Math.cos(src.angles[i]) * src.distances[i] + windX * src.heights[i]);
          pos.setY(i, src.position.y + src.heights[i]);
          pos.setZ(i, src.position.z + Math.sin(src.angles[i]) * src.distances[i] + windZ * src.heights[i]);

          const t = src.heights[i] / 200;
          col.setXYZ(i, 0.9 + t * 0.1, 0.5 - t * 0.2, 0.1 + t * 0.05);
        }
      }

      pos.needsUpdate = true;
      col.needsUpdate = true;
      src.marker.scale.setScalar(1 + Math.sin(this.time * 5) * 0.2);
    }
  }
}
