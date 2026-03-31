import * as THREE from "three";
import { latLonToLocal } from "./coords";

const CHANNEL_Y = -16;

export function createChannels(): { group: THREE.Group; animate: () => void } {
  const group = new THREE.Group();
  group.name = "channels";

  // 주항로 좌표
  const mainChannel = [
    [126.610, 37.480], [126.608, 37.485], [126.606, 37.490],
    [126.605, 37.495], [126.604, 37.500], [126.603, 37.505],
    [126.602, 37.510],
  ];

  // 보조항로
  const subChannel = [
    [126.595, 37.482], [126.594, 37.488], [126.593, 37.494],
    [126.592, 37.500], [126.592, 37.506],
  ];

  // 항로 라인 생성
  function createChannelLine(coords: number[][], color: number, width: number, dashSize: number) {
    const points: THREE.Vector3[] = coords.map(
      ([lon, lat]) => latLonToLocal(lat, lon, CHANNEL_Y)
    );

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // 대시 라인 거리 계산
    const distances = [0];
    for (let i = 1; i < points.length; i++) {
      distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
    }
    geometry.setAttribute("lineDistance", new THREE.Float32BufferAttribute(distances, 1));

    const material = new THREE.LineDashedMaterial({
      color,
      dashSize,
      gapSize: dashSize * 0.6,
      transparent: true,
      opacity: 0.7,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return { line, material };
  }

  const { line: main, material: mainMat } = createChannelLine(mainChannel, 0x3b82f6, 15, 15);
  const { line: sub, material: subMat } = createChannelLine(subChannel, 0x3b82f6, 10, 10);
  group.add(main);
  group.add(sub);

  // 정박지 A
  const anchA = latLonToLocal(37.492, 126.590, CHANNEL_Y);
  const anchAGeo = new THREE.RingGeometry(150, 180, 32);
  const anchAMat = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const anchAMesh = new THREE.Mesh(anchAGeo, anchAMat);
  anchAMesh.rotation.x = -Math.PI / 2;
  anchAMesh.position.copy(anchA);
  group.add(anchAMesh);

  // 정박지 B
  const anchB = latLonToLocal(37.503, 126.600, CHANNEL_Y);
  const anchBGeo = new THREE.RingGeometry(120, 150, 32);
  const anchBMat = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const anchBMesh = new THREE.Mesh(anchBGeo, anchBMat);
  anchBMesh.rotation.x = -Math.PI / 2;
  anchBMesh.position.copy(anchB);
  group.add(anchBMesh);

  // 정박지 라벨 (스프라이트)
  for (const [label, pos] of [["정박지 A", anchA], ["정박지 B", anchB]] as const) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(139, 92, 246, 0.9)";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(pos.x, CHANNEL_Y + 30, pos.z);
    sprite.scale.set(80, 20, 1);
    group.add(sprite);
  }

  let time = 0;
  const animate = () => {
    time += 0.05;
    // 대시 라인 흐르는 효과
    (mainMat as any).dashOffset = -time;
    (subMat as any).dashOffset = -time * 0.8;
  };

  return { group, animate };
}
