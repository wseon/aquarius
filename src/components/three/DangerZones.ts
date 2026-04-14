import * as THREE from "three";
import { latLonToLocal } from "./coords";

const ZONE_Y = -15;

interface ZoneData {
  name: string;
  coords: [number, number][];  // [lon, lat]
  color: number;
}

const ZONES: ZoneData[] = [
  {
    name: "얕은 수심 주의",
    coords: [[128.795, 35.045], [128.810, 35.045], [128.810, 35.050], [128.795, 35.050]],
    color: 0xef4444,
  },
  {
    name: "조류 위험",
    coords: [[128.780, 35.055], [128.795, 35.055], [128.795, 35.060], [128.780, 35.060]],
    color: 0xf97316,
  },
  {
    name: "통항 혼잡",
    coords: [[128.800, 35.068], [128.815, 35.068], [128.815, 35.073], [128.800, 35.073]],
    color: 0xeab308,
  },
];

function createWarningIcon(color: number): THREE.Group {
  const icon = new THREE.Group();

  const triShape = new THREE.Shape();
  triShape.moveTo(0, 12);
  triShape.lineTo(-8, -4);
  triShape.lineTo(8, -4);
  triShape.closePath();

  const triGeo = new THREE.ShapeGeometry(triShape);
  const triMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const tri = new THREE.Mesh(triGeo, triMat);
  icon.add(tri);

  const barGeo = new THREE.PlaneGeometry(2, 7);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(0, 5, 0.1);
  icon.add(bar);

  const dotGeo = new THREE.CircleGeometry(1.2, 8);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.position.set(0, -1, 0.1);
  icon.add(dot);

  return icon;
}

export function createDangerZones(): {
  group: THREE.Group;
  animate: () => void;
  checkVesselInZone: (x: number, z: number) => boolean;
  setAlert: (active: boolean) => void;
} {
  const group = new THREE.Group();
  group.name = "dangerZones";

  const icons: THREE.Group[] = [];
  const zoneMeshes: THREE.Mesh[] = [];

  for (const zone of ZONES) {
    const shape = new THREE.Shape();
    const pts = zone.coords.map(([lon, lat]) => latLonToLocal(lat, lon, ZONE_Y));
    shape.moveTo(pts[0].x, -pts[0].z);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i].x, -pts[i].z);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: zone.color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = ZONE_Y;
    group.add(mesh);
    zoneMeshes.push(mesh);

    const edgePoints = [...pts, pts[0]];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: zone.color,
      transparent: true,
      opacity: 0.6,
    });
    group.add(new THREE.Line(lineGeo, lineMat));

    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;

    const icon = createWarningIcon(zone.color);
    icon.position.set(cx, ZONE_Y + 40, cz);
    icon.scale.set(2.5, 2.5, 2.5);
    group.add(icon);
    icons.push(icon);

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const hexColor = "#" + zone.color.toString(16).padStart(6, "0");
    ctx.fillStyle = hexColor;
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(zone.name, 256, 45);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(cx, ZONE_Y + 65, cz);
    sprite.scale.set(120, 15, 1);
    group.add(sprite);
  }

  const zoneBounds: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  for (const zone of ZONES) {
    const pts = zone.coords.map(([lon, lat]) => latLonToLocal(lat, lon, 0));
    const xs = pts.map(p => p.x);
    const zs = pts.map(p => p.z);
    zoneBounds.push({
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minZ: Math.min(...zs), maxZ: Math.max(...zs),
    });
  }

  let alertActive = false;
  let time = 0;

  const checkVesselInZone = (x: number, z: number): boolean => {
    for (const b of zoneBounds) {
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return true;
      }
    }
    return false;
  };

  const setAlert = (active: boolean) => {
    alertActive = active;
  };

  const animate = () => {
    time += 0.03;

    for (let i = 0; i < icons.length; i++) {
      const baseY = ZONE_Y + 40;
      icons[i].position.y = baseY + Math.sin(time * 2 + i) * 8;
    }

    const blinkSpeed = alertActive ? 8 : 1.5;
    const baseOpacity = alertActive ? 0.25 : 0.15;
    const blinkRange = alertActive ? 0.2 : 0.1;

    for (const mesh of zoneMeshes) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = baseOpacity + Math.sin(time * blinkSpeed) * blinkRange;
    }
  };

  return { group, animate, checkVesselInZone, setAlert };
}
