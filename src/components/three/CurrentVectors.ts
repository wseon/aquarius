import * as THREE from "three";
import { latLonToLocal } from "./coords";

interface VectorData {
  lat: number;
  lon: number;
  speed: number;
  direction: number;
  layer: "surface" | "mid" | "bottom";
}

const LAYER_Y: Record<string, number> = {
  surface: -18,  // 해수면 바로 아래
  mid: -60,      // 중간
  bottom: -120,  // 해저 근처
};

const LAYER_COLOR: Record<string, THREE.Color> = {
  surface: new THREE.Color(1.0, 1.0, 1.0),     // 흰색
  mid: new THREE.Color(0.4, 0.85, 1.0),        // 밝은 청록
  bottom: new THREE.Color(0.15, 0.5, 0.85),    // 진한 파랑
};

export class CurrentVectorSystem {
  group: THREE.Group;
  private particles: Map<string, {
    points: THREE.Points;
    arrows: THREE.Group;
    velocities: { dx: number; dz: number; speed: number }[];
    origins: Float32Array;
    layer: string;
  }> = new Map();
  private allData: Record<string, VectorData[]> | null = null;
  private currentHour = 12;
  private seabedVisible = true;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = "currentVectors";
  }

  async load() {
    const res = await fetch("/api/current-vectors");
    const data = await res.json();
    this.allData = data.hours;
    this.buildParticles(this.currentHour);
  }

  // 특정 좌표에서 가장 가까운 수층별 해류 조회
  queryAtPosition(localX: number, localZ: number): { layer: string; speed: number; direction: number }[] | null {
    if (!this.allData) return null;
    const vectors = this.allData[String(this.currentHour)] || [];
    if (vectors.length === 0) return null;

    // 로컬 좌표 → 가장 가까운 벡터 찾기 (수층별)
    const layers = ["surface", "mid", "bottom"];
    const result: { layer: string; speed: number; direction: number }[] = [];

    for (const layerName of layers) {
      const layerVecs = vectors.filter((v: VectorData) => v.layer === layerName);
      let bestDist = Infinity;
      let bestVec: VectorData | null = null;

      for (const v of layerVecs) {
        const local = latLonToLocal(v.lat, v.lon, 0);
        const dist = Math.sqrt((local.x - localX) ** 2 + (local.z - localZ) ** 2);
        if (dist < bestDist) {
          bestDist = dist;
          bestVec = v;
        }
      }

      if (bestVec) {
        result.push({
          layer: layerName === "surface" ? "표층 (0-5m)" : layerName === "mid" ? "중층 (5-15m)" : "저층 (15m+)",
          speed: bestVec.speed,
          direction: bestVec.direction,
        });
      }
    }

    return result.length > 0 ? result : null;
  }

  setHour(hour: number) {
    if (hour === this.currentHour) return;
    this.currentHour = hour;
    this.buildParticles(hour);
  }

  setSeabedVisible(visible: boolean) {
    this.seabedVisible = visible;
    // 표층은 항상 보임, 중층/저층은 해저지형 ON일 때만
    for (const [layer, data] of this.particles) {
      if (layer === "surface") {
        data.points.visible = true;
        data.arrows.visible = true;
      } else {
        data.points.visible = visible;
        data.arrows.visible = visible;
      }
    }
  }

  private buildParticles(hour: number) {
    // 기존 제거
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.particles.clear();

    if (!this.allData) return;
    const vectors = this.allData[String(hour)] || [];

    // 수층별 분류
    const byLayer: Record<string, VectorData[]> = { surface: [], mid: [], bottom: [] };
    for (const v of vectors) {
      byLayer[v.layer]?.push(v);
    }

    for (const [layer, vecs] of Object.entries(byLayer)) {
      if (vecs.length === 0) continue;

      const y = LAYER_Y[layer] || -18;
      const color = LAYER_COLOR[layer] || new THREE.Color(1, 1, 1);

      // 각 벡터 위치에 파티클 5개씩 (흐름 표현)
      const particleCount = vecs.length * 5;
      const positions = new Float32Array(particleCount * 3);
      const origins = new Float32Array(particleCount * 3);
      const velocities: { dx: number; dz: number; speed: number }[] = [];

      for (let vi = 0; vi < vecs.length; vi++) {
        const v = vecs[vi];
        const local = latLonToLocal(v.lat, v.lon, y);
        const rad = (v.direction * Math.PI) / 180;
        const dx = Math.sin(rad) * v.speed * 0.3;
        const dz = -Math.cos(rad) * v.speed * 0.3;

        for (let pi = 0; pi < 5; pi++) {
          const idx = (vi * 5 + pi) * 3;
          // 초기 위치를 흐름 방향을 따라 분산
          const spread = (pi - 2) * 15;
          positions[idx] = local.x + dx * spread + (Math.random() - 0.5) * 20;
          positions[idx + 1] = local.y + (Math.random() - 0.5) * 3;
          positions[idx + 2] = local.z + dz * spread + (Math.random() - 0.5) * 20;

          origins[idx] = local.x;
          origins[idx + 1] = local.y;
          origins[idx + 2] = local.z;

          velocities.push({ dx, dz, speed: v.speed });
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: color,
        size: layer === "surface" ? 4 : 3,
        transparent: true,
        opacity: layer === "surface" ? 0.9 : 0.6,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      this.group.add(points);

      // 방향 화살표 (표층만)
      const arrowGroup = new THREE.Group();
      if (layer === "surface") {
        for (let vi = 0; vi < vecs.length; vi++) {
          const v = vecs[vi];
          const local = latLonToLocal(v.lat, v.lon, y + 2);
          const rad = (v.direction * Math.PI) / 180;

          // 화살표 선
          const len = v.speed * 30;
          const endX = local.x + Math.sin(rad) * len;
          const endZ = local.z - Math.cos(rad) * len;

          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(local.x, local.y, local.z),
            new THREE.Vector3(endX, local.y, endZ),
          ]);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
          });
          arrowGroup.add(new THREE.Line(lineGeo, lineMat));
        }
      }
      this.group.add(arrowGroup);

      // 중층/저층은 해저지형 ON일 때만
      if (layer !== "surface" && !this.seabedVisible) {
        points.visible = false;
        arrowGroup.visible = false;
      }

      this.particles.set(layer, {
        points,
        arrows: arrowGroup,
        velocities,
        origins,
        layer,
      });
    }
  }

  animate() {
    for (const [, data] of this.particles) {
      if (!data.points.visible) continue;
      const pos = data.points.geometry.getAttribute("position") as THREE.BufferAttribute;

      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) + data.velocities[i].dx;
        let z = pos.getZ(i) + data.velocities[i].dz;

        // 원점에서 너무 멀어지면 리셋
        const ox = data.origins[i * 3];
        const oz = data.origins[i * 3 + 2];
        const dist = Math.sqrt((x - ox) ** 2 + (z - oz) ** 2);
        if (dist > 80) {
          x = ox + (Math.random() - 0.5) * 20;
          z = oz + (Math.random() - 0.5) * 20;
        }

        pos.setX(i, x);
        pos.setZ(i, z);
      }

      pos.needsUpdate = true;
    }
  }
}
