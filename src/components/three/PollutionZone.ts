import * as THREE from "three";

// 오염구역 대상 건물 ID 목록
const POLLUTION_BUILDING_IDS = [
  { id: "B2491_37.4975_126.6218", value: 187, name: "A구역" },
  { id: "B0339_37.4833_126.6224", value: 243, name: "B구역" },
  { id: "B0512_37.4866_126.6112", value: 156, name: "C구역" },
];

export function createPollutionZones(buildingsGroup: THREE.Group): {
  group: THREE.Group;
  animate: () => void;
} {
  const group = new THREE.Group();
  group.name = "pollutionZone";

  const flashTargets: { mesh: THREE.Mesh; origColor: THREE.Color; origEmissive: THREE.Color }[] = [];
  let time = 0;

  // buildingsGroup에서 대상 건물 찾기
  let totalMeshes = 0;
  let matchCount = 0;
  for (const pb of POLLUTION_BUILDING_IDS) {
    buildingsGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) totalMeshes++;
      if (child instanceof THREE.Mesh && child.userData.buildingId === pb.id) {
        matchCount++;
        const mat = child.material as THREE.MeshPhongMaterial;
        flashTargets.push({
          mesh: child,
          origColor: mat.color.clone(),
          origEmissive: mat.emissive.clone(),
        });

        // 오염 수치 라벨 — 건물 바운딩 박스 중심 상단에 배치
        const label = createPollutionLabel(pb.value, pb.name);
        const box = new THREE.Box3().setFromObject(child);
        const center = box.getCenter(new THREE.Vector3());
        const top = box.max.y;
        label.position.set(center.x, top + 100, center.z);
        group.add(label);
      }
    });
  }

  console.log(`PollutionZone: searched ${totalMeshes} meshes, matched ${matchCount}, flashTargets=${flashTargets.length}`);

  let wasVisible = false;

  const animate = () => {
    time += 0.05;
    const isVisible = group.visible;

    if (isVisible) {
      const flash = (Math.sin(time * 3) + 1) / 2;
      for (const ft of flashTargets) {
        // 직접 새 material 색상 설정
        (ft.mesh.material as THREE.MeshPhongMaterial).color.setRGB(
          ft.origColor.r * (1 - flash * 0.7) + 0.8 * flash * 0.7,
          ft.origColor.g * (1 - flash * 0.7) + 0.13 * flash * 0.7,
          ft.origColor.b * (1 - flash * 0.7) + 0.13 * flash * 0.7,
        );
        (ft.mesh.material as THREE.MeshPhongMaterial).emissive.setRGB(
          0.3 * flash, 0.05 * flash, 0.05 * flash
        );
      }
      wasVisible = true;
    } else if (wasVisible) {
      // OFF 전환 시 1회만 복원
      for (const ft of flashTargets) {
        (ft.mesh.material as THREE.MeshPhongMaterial).color.copy(ft.origColor);
        (ft.mesh.material as THREE.MeshPhongMaterial).emissive.copy(ft.origEmissive);
      }
      wasVisible = false;
    }
  };

  return { group, animate };
}

function createPollutionLabel(value: number, name: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgba(180, 30, 30, 0.85)";
  ctx.beginPath();
  ctx.roundRect(16, 16, 480, 224, 24);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 80, 80, 0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(16, 16, 480, 224, 24);
  ctx.stroke();

  ctx.fillStyle = "#ffcccc";
  ctx.font = "bold 48px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, 256, 90);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 80px sans-serif";
  ctx.fillText(`${value} score`, 256, 190);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(320, 160, 1);
  return sprite;
}
