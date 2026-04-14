/**
 * 항만 3D 모델 생성 스크립트
 * 간단한 GLB 형태의 크레인, 컨테이너, 선박을 생성합니다.
 */
import { writeFileSync } from "fs";

// GLB 파일 생성 헬퍼
function createGLB(meshData) {
  const { positions, indices, color } = meshData;

  const posBuffer = new Float32Array(positions);
  const idxBuffer = new Uint16Array(indices);

  // 바운딩 박스 계산
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < posBuffer.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      min[j] = Math.min(min[j], posBuffer[i + j]);
      max[j] = Math.max(max[j], posBuffer[i + j]);
    }
  }

  const gltf = {
    asset: { version: "2.0", generator: "sd26-port-gen" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: color,
          metallicFactor: 0.3,
          roughnessFactor: 0.7,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: posBuffer.length / 3,
        type: "VEC3",
        min,
        max,
      },
      {
        bufferView: 1,
        componentType: 5123, // UNSIGNED_SHORT
        count: idxBuffer.length,
        type: "SCALAR",
        min: [0],
        max: [posBuffer.length / 3 - 1],
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: posBuffer.byteLength,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: posBuffer.byteLength,
        byteLength: idxBuffer.byteLength,
        target: 34963, // ELEMENT_ARRAY_BUFFER
      },
    ],
    buffers: [
      {
        byteLength: posBuffer.byteLength + idxBuffer.byteLength,
      },
    ],
  };

  const jsonStr = JSON.stringify(gltf);
  // 4바이트 정렬
  const jsonPad = jsonStr.length % 4 === 0 ? 0 : 4 - (jsonStr.length % 4);
  const jsonChunkLength = jsonStr.length + jsonPad;

  const binData = new Uint8Array(posBuffer.byteLength + idxBuffer.byteLength);
  binData.set(new Uint8Array(posBuffer.buffer), 0);
  binData.set(new Uint8Array(idxBuffer.buffer), posBuffer.byteLength);
  const binPad = binData.byteLength % 4 === 0 ? 0 : 4 - (binData.byteLength % 4);
  const binChunkLength = binData.byteLength + binPad;

  const totalLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);
  const bytes = new Uint8Array(glb);

  // Header
  view.setUint32(0, 0x46546c67, true); // glTF
  view.setUint32(4, 2, true); // version
  view.setUint32(8, totalLength, true);

  // JSON chunk
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, 0x4e4f534a, true); // JSON
  for (let i = 0; i < jsonStr.length; i++) {
    bytes[20 + i] = jsonStr.charCodeAt(i);
  }
  for (let i = 0; i < jsonPad; i++) {
    bytes[20 + jsonStr.length + i] = 0x20; // space padding
  }

  // BIN chunk
  const binOffset = 20 + jsonChunkLength;
  view.setUint32(binOffset, binChunkLength, true);
  view.setUint32(binOffset + 4, 0x004e4942, true); // BIN
  bytes.set(binData, binOffset + 8);

  return Buffer.from(glb);
}

// 박스 메시 생성 (x, y, z 크기)
function box(sx, sy, sz, ox = 0, oy = 0, oz = 0) {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  return {
    positions: [
      // Front
      -x+ox, -y+oy, z+oz,  x+ox, -y+oy, z+oz,  x+ox, y+oy, z+oz,  -x+ox, y+oy, z+oz,
      // Back
      x+ox, -y+oy, -z+oz,  -x+ox, -y+oy, -z+oz,  -x+ox, y+oy, -z+oz,  x+ox, y+oy, -z+oz,
      // Top
      -x+ox, y+oy, z+oz,  x+ox, y+oy, z+oz,  x+ox, y+oy, -z+oz,  -x+ox, y+oy, -z+oz,
      // Bottom
      -x+ox, -y+oy, -z+oz,  x+ox, -y+oy, -z+oz,  x+ox, -y+oy, z+oz,  -x+ox, -y+oy, z+oz,
      // Right
      x+ox, -y+oy, z+oz,  x+ox, -y+oy, -z+oz,  x+ox, y+oy, -z+oz,  x+ox, y+oy, z+oz,
      // Left
      -x+ox, -y+oy, -z+oz,  -x+ox, -y+oy, z+oz,  -x+ox, y+oy, z+oz,  -x+ox, y+oy, -z+oz,
    ],
    indices: [
      0,1,2, 0,2,3,     4,5,6, 4,6,7,
      8,9,10, 8,10,11,  12,13,14, 12,14,15,
      16,17,18, 16,18,19, 20,21,22, 20,22,23,
    ],
  };
}

// 여러 박스를 합치기
function merge(...parts) {
  const positions = [];
  const indices = [];
  let vertexOffset = 0;

  for (const part of parts) {
    positions.push(...part.positions);
    for (const idx of part.indices) {
      indices.push(idx + vertexOffset);
    }
    vertexOffset += part.positions.length / 3;
  }

  return { positions, indices };
}

// === 1. 갠트리 크레인 ===
function createCrane() {
  const merged = merge(
    // 좌측 다리
    box(3, 50, 3, -15, 25, 0),
    // 우측 다리
    box(3, 50, 3, 15, 25, 0),
    // 상단 가로빔
    box(40, 4, 3, 0, 52, 0),
    // 붐 (앞으로 돌출)
    box(5, 3, 50, 0, 54, 25),
    // 기계실
    box(8, 8, 8, 0, 50, -5),
    // 좌측 하단 레일
    box(20, 2, 3, -15, 1, 0),
    // 우측 하단 레일
    box(20, 2, 3, 15, 1, 0),
  );
  return createGLB({ ...merged, color: [0.9, 0.4, 0.1, 1.0] }); // 주황색
}

// === 2. 컨테이너 스택 ===
function createContainerStack() {
  const merged = merge(
    // 1층 - 3개 나란히
    box(12, 2.6, 2.4, -13, 1.3, 0),
    box(12, 2.6, 2.4, 0, 1.3, 0),
    box(12, 2.6, 2.4, 13, 1.3, 0),
    // 2층
    box(12, 2.6, 2.4, -13, 3.9, 0),
    box(12, 2.6, 2.4, 0, 3.9, 0),
    box(12, 2.6, 2.4, 13, 3.9, 0),
    // 3층
    box(12, 2.6, 2.4, -13, 6.5, 0),
    box(12, 2.6, 2.4, 0, 6.5, 0),
  );
  return createGLB({ ...merged, color: [0.2, 0.5, 0.8, 1.0] }); // 파란색
}

// === 3. 컨테이너 선박 ===
function createContainerShip() {
  const merged = merge(
    // 선체
    box(30, 10, 150, 0, 5, 0),
    // 선교 (브릿지)
    box(15, 15, 15, 0, 17, -55),
    // 컨테이너 적재
    box(25, 12, 80, 0, 16, 15),
    // 굴뚝
    box(5, 10, 5, 0, 27, -55),
    // 선수 (뾰족하게 대신 작은 박스)
    box(20, 8, 15, 0, 4, 75),
  );
  return createGLB({ ...merged, color: [0.3, 0.3, 0.35, 1.0] }); // 회색
}

// === 4. 창고/터미널 건물 ===
function createWarehouse() {
  const merged = merge(
    // 본체
    box(60, 15, 30, 0, 7.5, 0),
    // 지붕 (약간 돌출)
    box(64, 2, 34, 0, 16, 0),
  );
  return createGLB({ ...merged, color: [0.7, 0.7, 0.65, 1.0] }); // 밝은 회색
}

// 생성 및 저장
writeFileSync("public/models/crane.glb", createCrane());
writeFileSync("public/models/container-stack.glb", createContainerStack());
writeFileSync("public/models/container-ship.glb", createContainerShip());
writeFileSync("public/models/warehouse.glb", createWarehouse());

console.log("모델 생성 완료:");
console.log("  - crane.glb (갠트리 크레인)");
console.log("  - container-stack.glb (컨테이너 적재)");
console.log("  - container-ship.glb (컨테이너 선박)");
console.log("  - warehouse.glb (창고/터미널)");
