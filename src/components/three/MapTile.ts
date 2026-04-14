import * as THREE from "three";
import { latLonToLocal } from "./coords";

// ROI 범위
const ROI = {
  north: 37.51254,
  south: 37.47991,
  west: 126.58342,
  east: 126.64548,
};

export async function createMapTile(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = "mapTile";

  const zoom = 15;

  // 위경도 → 타일 좌표
  function lonLatToTile(lon: number, lat: number, z: number) {
    const n = 2 ** z;
    const x = Math.floor(((lon + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return { x, y };
  }

  function tileToLonLat(x: number, y: number, z: number) {
    const n = 2 ** z;
    const lon = (x / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const lat = (latRad * 180) / Math.PI;
    return { lon, lat };
  }

  const tileMin = lonLatToTile(ROI.west, ROI.north, zoom);
  const tileMax = lonLatToTile(ROI.east, ROI.south, zoom);

  const loader = new THREE.TextureLoader();

  for (let tx = tileMin.x; tx <= tileMax.x; tx++) {
    for (let ty = tileMin.y; ty <= tileMax.y; ty++) {
      const url = `https://basemaps.cartocdn.com/light_nolabels/${zoom}/${tx}/${ty}@2x.png`;

      try {
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
        // 바다 영역을 파란색으로 변환
        const img = texture.image as HTMLImageElement;
        const cvs = document.createElement("canvas");
        cvs.width = img.width;
        cvs.height = img.height;
        const ctx = cvs.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
        const px = imageData.data;
        for (let k = 0; k < px.length; k += 4) {
          const r = px[k], g = px[k + 1], b = px[k + 2];
          // 바다 판별: B > R+15 && G > R+5 && B > 200
          if (b > r + 15 && g > r + 5 && b > 200) {
            px[k] = 20;      // R
            px[k + 1] = 60;  // G
            px[k + 2] = 120; // B
          }
        }
        ctx.putImageData(imageData, 0, 0);
        texture.image = cvs;
        texture.needsUpdate = true;

        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // 이 타일의 위경도 범위
        const nw = tileToLonLat(tx, ty, zoom);
        const se = tileToLonLat(tx + 1, ty + 1, zoom);

        // 4 모서리를 로컬 좌표로
        const topLeft = latLonToLocal(nw.lat, nw.lon, 0);
        const bottomRight = latLonToLocal(se.lat, se.lon, 0);

        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.z - topLeft.z);
        const centerX = (topLeft.x + bottomRight.x) / 2;
        const centerZ = (topLeft.z + bottomRight.z) / 2;

        const geo = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(centerX, 98, centerZ);

        group.add(mesh);
      } catch {
        // 타일 로드 실패 시 스킵
      }
    }
  }

  return group;
}
