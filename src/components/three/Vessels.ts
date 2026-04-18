import * as THREE from "three";
import { latLonToLocal } from "./coords";

interface VesselData {
  mmsi: string;
  name: string;
  callSign?: string;
  type: string;
  typeCode?: number;
  lat: number;
  lon: number;
  heading: number;
  cog?: number;
  speed: number;
  sog?: number;
  status: string;
  navStatus?: number;
  length: number;
  width?: number;
  draft?: number;
  destination?: string;
  eta?: string;
  flag?: string;
}

const STATUS_COLOR: Record<string, number> = {
  "하역중": 0x22c55e,
  "입항중": 0xeab308,
  "항행중": 0x3b82f6,
  "정박": 0x8b5cf6,
  "출항중": 0xf97316,
};

interface ShipColors {
  hull: number;      // 선체 하단
  upper: number;     // 선체 상단/갑판
  bridge: number;    // 선교
  stack: number;     // 굴뚝
  cargo: number;     // 화물
  bow: number;       // 선수
}

const TYPE_COLORS: Record<string, ShipColors> = {
  "컨테이너선": {
    hull: 0x1a1a2e,    // 진한 남색
    upper: 0x2d5a27,   // 짙은 초록 (에버그린 스타일)
    bridge: 0xe8e8e0,  // 흰색
    stack: 0x22aa44,   // 초록 굴뚝
    cargo: 0x2563eb,   // 파란 컨테이너
    bow: 0x1a1a2e,
  },
  "벌크선": {
    hull: 0x8b0000,    // 진한 빨강 (하단)
    upper: 0x2a2a2a,   // 검정
    bridge: 0xd4d4c8,  // 베이지
    stack: 0xcc3333,   // 빨간 굴뚝
    cargo: 0x5a4a3a,   // 갈색 화물창
    bow: 0x8b0000,
  },
  "유조선": {
    hull: 0x8b0000,    // 빨간 하단
    upper: 0x1a1a1a,   // 검정 상단
    bridge: 0xe0e0d8,  // 흰색
    stack: 0xff4444,   // 빨간 굴뚝
    cargo: 0x333333,   // 검정 탱크
    bow: 0x8b0000,
  },
  "화물선": {
    hull: 0x2a3a5a,    // 남색
    upper: 0x4a5a6a,   // 회색
    bridge: 0xd8d8d0,  // 밝은 회색
    stack: 0xddaa33,   // 노란 굴뚝
    cargo: 0x6a5a4a,   // 갈색
    bow: 0x2a3a5a,
  },
};

const DEFAULT_COLORS: ShipColors = {
  hull: 0x3a4555, upper: 0x4a5568, bridge: 0xd0d0c8,
  stack: 0xdc2626, cargo: 0x1e3a5f, bow: 0x3a4555,
};

function createShipGeometry(length: number, shipType: string): THREE.Group {
  const ship = new THREE.Group();
  const w = length * 0.2;
  const h = length * 0.06;
  const c = TYPE_COLORS[shipType] || DEFAULT_COLORS;

  // 선체 하단 (수선 아래)
  const hullGeo = new THREE.BoxGeometry(w, h * 0.6, length);
  const hullMat = new THREE.MeshPhongMaterial({ color: c.hull });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = h * 0.3;
  ship.add(hull);

  // 선체 상단
  const upperGeo = new THREE.BoxGeometry(w, h * 0.5, length);
  const upperMat = new THREE.MeshPhongMaterial({ color: c.upper });
  const upper = new THREE.Mesh(upperGeo, upperMat);
  upper.position.y = h * 0.85;
  ship.add(upper);

  // 선교 (브릿지)
  const bridgeGeo = new THREE.BoxGeometry(w * 0.5, h * 2.5, length * 0.12);
  const bridgeMat = new THREE.MeshPhongMaterial({ color: c.bridge });
  const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, h * 2, -length * 0.35);
  ship.add(bridge);

  // 굴뚝
  const stackGeo = new THREE.BoxGeometry(w * 0.15, h * 2, w * 0.15);
  const stackMat = new THREE.MeshPhongMaterial({ color: c.stack });
  const stack = new THREE.Mesh(stackGeo, stackMat);
  stack.position.set(0, h * 3.5, -length * 0.35);
  ship.add(stack);

  // 화물/컨테이너
  const cargoGeo = new THREE.BoxGeometry(w - 1, h * 1.5, length * 0.5);
  const cargoMat = new THREE.MeshPhongMaterial({ color: c.cargo });
  const cargo = new THREE.Mesh(cargoGeo, cargoMat);
  cargo.position.set(0, h * 1.5, length * 0.05);
  ship.add(cargo);

  // 선수
  const bowGeo = new THREE.ConeGeometry(w * 0.5, length * 0.1, 4);
  const bowMat = new THREE.MeshPhongMaterial({ color: c.bow });
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

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/vessels`);
  const data = await res.json();
  const vessels: VesselData[] = data.vessels;

  const VESSEL_Y = -15; // 해수면 높이
  const movingVessels: { mesh: THREE.Group; dx: number; dz: number; origin: THREE.Vector3 }[] = [];
  const labels: { name: string; status: string; speed: number; type: string; screenPos: THREE.Vector3; worldPos: THREE.Vector3 }[] = [];

  for (const v of vessels) {
    const local = latLonToLocal(v.lat, v.lon, VESSEL_Y);
    const ship = createShipGeometry(v.length * 1.2, v.type);

    // 선박 크기 원래 사이즈
    ship.scale.set(1, 1, 1);
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

    // AIS 정보 저장
    ship.userData = {
      vesselData: {
        mmsi: v.mmsi,
        name: v.name,
        callSign: v.callSign || "",
        type: v.type,
        typeCode: v.typeCode || 0,
        heading: v.heading,
        cog: v.cog || v.heading,
        sog: v.sog || v.speed,
        status: v.status,
        navStatus: v.navStatus || 0,
        length: v.length,
        width: v.width || 0,
        draft: v.draft || 0,
        destination: v.destination || "",
        eta: v.eta || "",
        flag: v.flag || "",
        lat: v.lat,
        lon: v.lon,
      },
    };
    // 자식 mesh에도 전파 (raycast가 자식을 히트할 수 있음)
    ship.traverse((child) => { child.userData.vesselRoot = ship; });

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
