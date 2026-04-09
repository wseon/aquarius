import * as THREE from "three";

const MARINE_Y = -14;
const AIR_BASE_Y = 10;
const MAX_RADIUS = 250;
const PARTICLES_PER_SOURCE = 300;

type PollutionType = "marine" | "air";

interface PollutionSource {
  type: PollutionType;
  position: THREE.Vector3;
  particles: THREE.Points;
  distances: Float32Array;
  angles: Float32Array;
  speeds: Float32Array;
  heights: Float32Array; // 대기 오염용
  marker: THREE.Mesh;
  label: THREE.Sprite;
}

export class PollutionSystem {
  group: THREE.Group;
  private sources: PollutionSource[] = [];
  private time = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = "pollution";
  }

  addMarineSource(position: THREE.Vector3, name?: string) {
    const src = this.createSource("marine", position, name || `해양오염 ${this.getCount("marine") + 1}`);
    this.sources.push(src);
    return this.sources.length;
  }

  addAirSource(position: THREE.Vector3, name?: string) {
    const src = this.createSource("air", position, name || `대기오염 ${this.getCount("air") + 1}`);
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

  private createSource(type: PollutionType, pos: THREE.Vector3, name: string): PollutionSource {
    const isMarine = type === "marine";
    const baseY = isMarine ? MARINE_Y : pos.y + AIR_BASE_Y;
    const sourcePos = new THREE.Vector3(pos.x, baseY, pos.z);

    const positions = new Float32Array(PARTICLES_PER_SOURCE * 3);
    const colors = new Float32Array(PARTICLES_PER_SOURCE * 3);
    const distances = new Float32Array(PARTICLES_PER_SOURCE);
    const angles = new Float32Array(PARTICLES_PER_SOURCE);
    const speeds = new Float32Array(PARTICLES_PER_SOURCE);
    const heights = new Float32Array(PARTICLES_PER_SOURCE);

    for (let i = 0; i < PARTICLES_PER_SOURCE; i++) {
      angles[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.2 + Math.random() * 0.6;
      distances[i] = Math.random() * (isMarine ? MAX_RADIUS * 0.1 : 10);
      heights[i] = Math.random() * 5;

      if (isMarine) {
        positions[i * 3] = sourcePos.x + Math.cos(angles[i]) * distances[i];
        positions[i * 3 + 1] = baseY + (Math.random() - 0.5) * 3;
        positions[i * 3 + 2] = sourcePos.z + Math.sin(angles[i]) * distances[i];
        // 빨강/주황
        colors[i * 3] = 0.7;
        colors[i * 3 + 1] = 0.1;
        colors[i * 3 + 2] = 0.05;
      } else {
        positions[i * 3] = sourcePos.x + (Math.random() - 0.5) * 8;
        positions[i * 3 + 1] = baseY + heights[i];
        positions[i * 3 + 2] = sourcePos.z + (Math.random() - 0.5) * 8;
        // 노란/주황 연기
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
      size: isMarine ? 5 : 6,
      transparent: true,
      opacity: isMarine ? 0.7 : 0.8,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    this.group.add(particles);

    // 마커
    const markerColor = isMarine ? 0xff0000 : 0x888888;
    const markerGeo = new THREE.SphereGeometry(isMarine ? 4 : 3, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: markerColor });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(sourcePos.x, baseY + (isMarine ? 10 : 20), sourcePos.z);
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

    return { type, position: sourcePos, particles, distances, angles, speeds, heights, marker, label };
  }

  animate() {
    if (!this.group.visible || this.sources.length === 0) return;
    this.time += 0.01;

    for (const src of this.sources) {
      const pos = src.particles.geometry.getAttribute("position") as THREE.BufferAttribute;
      const col = src.particles.geometry.getAttribute("color") as THREE.BufferAttribute;

      if (src.type === "marine") {
        // 해양: 수면 방사형 확산
        for (let i = 0; i < PARTICLES_PER_SOURCE; i++) {
          src.distances[i] += src.speeds[i] * 0.3;
          if (src.distances[i] > MAX_RADIUS) {
            src.distances[i] = Math.random() * 10;
            src.angles[i] = Math.random() * Math.PI * 2;
          }
          src.angles[i] += (Math.random() - 0.5) * 0.02;

          const drift = this.time * 0.3;
          pos.setX(i, src.position.x + Math.cos(src.angles[i]) * src.distances[i] + drift * 0.5);
          pos.setZ(i, src.position.z + Math.sin(src.angles[i]) * src.distances[i] - drift * 0.3);

          const t = src.distances[i] / MAX_RADIUS;
          col.setXYZ(i, 0.7 + t * 0.2, 0.1 + t * 0.4, 0.05 + t * 0.1);
        }
      } else {
        // 대기: 위로 올라가면서 퍼짐
        for (let i = 0; i < PARTICLES_PER_SOURCE; i++) {
          src.heights[i] += src.speeds[i] * 0.8;
          src.distances[i] += src.speeds[i] * 0.15;
          src.angles[i] += (Math.random() - 0.5) * 0.03;

          // 바람 효과 (약간 옆으로)
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

          // 높이에 따라 색상 변화 (노란→연한주황)
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
