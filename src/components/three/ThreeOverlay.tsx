"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as Cesium from "cesium";

// 위경도 → 로컬 좌표 (중심점 기준 미터)
const CENTER = { lat: 37.49625, lon: 126.60469 };

export function latLonToLocal(lat: number, lon: number, height: number = 0): THREE.Vector3 {
  const x = (lon - CENTER.lon) * 88000;
  const z = -(lat - CENTER.lat) * 111000;
  return new THREE.Vector3(x, height, z);
}

interface ThreeOverlayProps {
  cesiumViewer: Cesium.Viewer | null;
  children: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;
}

export default function ThreeOverlay({ cesiumViewer, children }: ThreeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!canvasRef.current || !cesiumViewer || cesiumViewer.isDestroyed()) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Three.js 셋업
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 100000);
    cameraRef.current = camera;

    // 조명
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    // 자식에서 씬에 오브젝트 추가
    children(scene, camera);

    // Cesium 카메라 → Three.js 카메라 동기화
    const syncCamera = () => {
      if (cesiumViewer.isDestroyed()) return;

      const cesiumCamera = cesiumViewer.camera;
      const carto = cesiumCamera.positionCartographic;
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);
      const height = carto.height;

      // Cesium 카메라 위치 → Three.js 로컬 좌표
      const camLocal = latLonToLocal(lat, lon, height);
      camera.position.set(camLocal.x, camLocal.y, camLocal.z);

      // Cesium 카메라 방향 → Three.js
      const dir = cesiumCamera.directionWC;
      const up = cesiumCamera.upWC;

      // Cesium ECEF 방향을 로컬 ENU 방향으로 변환
      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(
        Cesium.Cartesian3.fromDegrees(CENTER.lon, CENTER.lat, 0)
      );
      const invTransform = Cesium.Matrix4.inverse(transform, new Cesium.Matrix4());

      const localDir = Cesium.Matrix4.multiplyByPointAsVector(invTransform, dir, new Cesium.Cartesian3());
      const localUp = Cesium.Matrix4.multiplyByPointAsVector(invTransform, up, new Cesium.Cartesian3());

      // ENU(동,북,상) → Three.js(X=동, Y=상, Z=-북)
      const lookTarget = new THREE.Vector3(
        camera.position.x + localDir.x,
        camera.position.y + localDir.z,
        camera.position.z - localDir.y
      );
      camera.up.set(localUp.x, localUp.z, -localUp.y);
      camera.lookAt(lookTarget);

      camera.fov = Cesium.Math.toDegrees(cesiumCamera.frustum.fovy || 45);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
    };

    // 매 프레임 동기화
    cesiumViewer.scene.postRender.addEventListener(syncCamera);

    // 리사이즈
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cesiumViewer.scene.postRender.removeEventListener(syncCamera);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, [cesiumViewer]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}
