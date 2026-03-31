import * as THREE from "three";
import { latLonToLocal } from "./coords";

interface VesselData {
  mmsi: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  heading: number;
  speed: number;
  status: string;
  length: number;
}

const STATUS_COLOR: Record<string, number> = {
  "하역중": 0x22c55e,
  "입항중": 0xeab308,
  "항행중": 0x3b82f6,
  "정박": 0x8b5cf6,
  "출항중": 0xf97316,
};

function createShipGeometry(length: number): THREE.Group {
  const ship = new THREE.Group();
  const w = length * 0.2;
  const h = length * 0.06;

  // 선체
  const hullGeo = new THREE.BoxGeometry(w, h, length);
  const hullMat = new THREE.MeshPhongMaterial({ color: 0x3a4555 });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = h / 2;
  ship.add(hull);

  // 선교 (브릿지)
  const bridgeGeo = new THREE.BoxGeometry(w * 0.5, h * 2.5, length * 0.12);
  const bridgeMat = new THREE.MeshPhongMaterial({ color: 0x4a5568 });
  const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, h * 2, -length * 0.35);
  ship.add(bridge);

  // 굴뚝
  const stackGeo = new THREE.BoxGeometry(w * 0.15, h * 2, w * 0.15);
  const stackMat = new THREE.MeshPhongMaterial({ color: 0xdc2626 });
  const stack = new THREE.Mesh(stackGeo, stackMat);
  stack.position.set(0, h * 3.5, -length * 0.35);
  ship.add(stack);

  // 컨테이너 적재 (컨테이너선만)
  const cargoGeo = new THREE.BoxGeometry(w - 1, h * 1.5, length * 0.5);
  const cargoMat = new THREE.MeshPhongMaterial({ color: 0x1e3a5f });
  const cargo = new THREE.Mesh(cargoGeo, cargoMat);
  cargo.position.set(0, h * 1.5, length * 0.05);
  ship.add(cargo);

  // 선수 (앞쪽 뾰족하게)
  const bowGeo = new THREE.ConeGeometry(w * 0.5, length * 0.1, 4);
  const bowMat = new THREE.MeshPhongMaterial({ color: 0x3a4555 });
  const bow = new THREE.Mesh(bowGeo, bowMat);
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, h / 2, length * 0.55);
  ship.add(bow);

  return ship;
}

export async function createVessels(): Promise<{
  group: THREE.Group;
  labels: { name: string; status: string; speed: number; type: string; screenPos: THREE.Vector3; worldPos: THREE.Vector3 }[];
  animate: () => void;
}> {
  const group = new THREE.Group();
  group.name = "vessels";

  const res = await fetch("/api/vessels");
  const data = await res.json();
  const vessels: VesselData[] = data.vessels;

  const VESSEL_Y = -15; // 해수면 높이
  const movingVessels: { mesh: THREE.Group; dx: number; dz: number; origin: THREE.Vector3 }[] = [];
  const labels: { name: string; status: string; speed: number; type: string; screenPos: THREE.Vector3; worldPos: THREE.Vector3 }[] = [];

  for (const v of vessels) {
    const local = latLonToLocal(v.lat, v.lon, VESSEL_Y);
    const ship = createShipGeometry(v.length * 1.2); // 4배 확대

    // heading 적용 (0=북, 시계방향)
    ship.rotation.y = -((v.heading * Math.PI) / 180);
    ship.position.copy(local);

    // 상태 표시등
    const statusColor = STATUS_COLOR[v.status] || 0xffffff;
    const lightGeo = new THREE.SphereGeometry(2, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: statusColor });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(0, v.length * 0.06 * 4, 0);
    ship.add(light);

    group.add(ship);

    // 이동 중인 선박 애니메이션
    if (v.speed > 0) {
      const rad = (v.heading * Math.PI) / 180;
      movingVessels.push({
        mesh: ship,
        dx: Math.sin(rad) * v.speed * 0.02,
        dz: -Math.cos(rad) * v.speed * 0.02,
        origin: local.clone(),
      });
    }

    // 라벨 데이터
    labels.push({
      name: v.name,
      status: v.status,
      speed: v.speed,
      type: v.type,
      screenPos: new THREE.Vector3(),
      worldPos: new THREE.Vector3(local.x, local.y + v.length * 0.06 * 5, local.z),
    });
  }

  const animate = () => {
    for (const mv of movingVessels) {
      mv.mesh.position.x += mv.dx;
      mv.mesh.position.z += mv.dz;

      // 원점에서 200 이상 벗어나면 리셋
      const dist = mv.mesh.position.distanceTo(mv.origin);
      if (dist > 200) {
        mv.mesh.position.copy(mv.origin);
      }
    }
  };

  console.log(`선박 ${vessels.length}척 로드`);
  return { group, labels, animate };
}
