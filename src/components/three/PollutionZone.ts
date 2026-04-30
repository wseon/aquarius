import * as THREE from "three";

const POLLUTION_BUILDING_IDS = [
  { id: "6c74332e-bd5c-41c5-aac4-81b5402c6c8d", value: 192, name: "A구역" },
  { id: "ee2ead72-1554-4ee7-a617-37f039d131b3", value: 231, name: "B구역" },
  { id: "d3ba8e35-4765-4984-9ddc-f5ac8e897a35", value: 148, name: "C구역" },
];

export function createPollutionZones(buildingsGroup: THREE.Group): {
  group: THREE.Group;
  animate: () => void;
} {
  const group = new THREE.Group();
  group.name = "pollutionZone";

  const flashTargets: { mesh: THREE.Mesh; origColor: THREE.Color; origEmissive: THREE.Color }[] = [];
  let time = 0;

  for (const pb of POLLUTION_BUILDING_IDS) {
    buildingsGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.buildingId === pb.id) {
        const mat = child.material as THREE.MeshPhongMaterial;
        flashTargets.push({
          mesh: child,
          origColor: mat.color.clone(),
          origEmissive: mat.emissive.clone(),
        });

        const label = createPollutionLabel(pb.value, pb.name);
        const box = new THREE.Box3().setFromObject(child);
        const center = box.getCenter(new THREE.Vector3());
        const top = box.max.y;
        label.position.set(center.x, top + 100, center.z);
        group.add(label);
      }
    });
  }

  let wasVisible = false;

  const animate = () => {
    time += 0.05;
    const isVisible = group.visible;

    if (isVisible) {
      const flash = (Math.sin(time * 3) + 1) / 2;
      for (const ft of flashTargets) {
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
