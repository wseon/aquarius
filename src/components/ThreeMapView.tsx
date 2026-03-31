"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
// OrbitControls 대신 직접 카메라 컨트롤 구현
import { useLayerStore } from "@/stores/layerStore";
import { createBathymetryMesh } from "./three/BathymetryMesh";
import { createMapTile } from "./three/MapTile";
import { createBuildings } from "./three/Buildings";
import { createCurrentFlow } from "./three/CurrentFlow";

export default function ThreeMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const layerGroupsRef = useRef<Record<string, THREE.Object3D>>({});
  const layers = useLayerStore();

  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;

    // Renderer
    const w = containerRef.current.clientWidth || window.innerWidth;
    const h = containerRef.current.clientHeight || window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x0a0f1a);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1a2030, 5000, 12000);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      20000
    );
    camera.position.set(0, 2500, 2000); // 초기값, 아래에서 덮어씀
    cameraRef.current = camera;

    // 직접 카메라 컨트롤
    const canvas = renderer.domElement;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // 궤도 카메라 상태
    const target = new THREE.Vector3(-158, 0, 2694);
    let spherical = new THREE.Spherical(5000, 0.922, -1.144);
    let isDragging = false;
    let dragButton = -1;
    let lastX = 0, lastY = 0;

    const updateCamera = () => {
      const offset = new THREE.Vector3().setFromSpherical(spherical);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
    };

    // 초기 뷰 적용
    updateCamera();

    canvas.addEventListener("pointerdown", (e) => {
      isDragging = true;
      dragButton = e.button;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (dragButton === 0) {
        // 좌클릭 → 이동 (Cesium 스타일)
        const panSpeed = spherical.radius * 0.001;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        right.crossVectors(camera.getWorldDirection(new THREE.Vector3()), up).normalize();
        const forward = new THREE.Vector3();
        forward.crossVectors(up, right).normalize();
        target.add(right.multiplyScalar(-dx * panSpeed));
        target.add(forward.multiplyScalar(-dy * panSpeed));
        updateCamera();
      } else if (dragButton === 2) {
        // 우클릭 → 회전 (Cesium 스타일)
        spherical.theta -= dx * 0.005;
        spherical.phi -= dy * 0.005;
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.1, spherical.phi));
        updateCamera();
      }
    });

    canvas.addEventListener("pointerup", (e) => {
      isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
      // 카메라 상태 로그
      console.log(`[CAM] target:(${target.x.toFixed(0)},${target.y.toFixed(0)},${target.z.toFixed(0)}) radius:${spherical.radius.toFixed(0)} theta:${spherical.theta.toFixed(3)} phi:${spherical.phi.toFixed(3)}`);
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      spherical.radius = Math.max(200, Math.min(5000, spherical.radius * zoomFactor));
      updateCamera();
      console.log(`[CAM] target:(${target.x.toFixed(0)},${target.y.toFixed(0)},${target.z.toFixed(0)}) radius:${spherical.radius.toFixed(0)} theta:${spherical.theta.toFixed(3)} phi:${spherical.phi.toFixed(3)}`);
    }, { passive: false });

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(500, 1000, 500);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    fillLight.position.set(-300, 500, -300);
    scene.add(fillLight);

    // 그리드
    const gridHelper = new THREE.GridHelper(6000, 60, 0x1a2038, 0x141828);
    gridHelper.position.y = -1;
    scene.add(gridHelper);

    // 데이터 로드
    loadAll(scene);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  async function loadAll(scene: THREE.Scene) {
    // 지도 타일
    const mapTile = await createMapTile();
    scene.add(mapTile);
    layerGroupsRef.current["map"] = mapTile;

    // 수심 메시
    const bathymetry = await createBathymetryMesh();
    scene.add(bathymetry);
    layerGroupsRef.current["bathymetry"] = bathymetry;

    // 건물
    const buildings = await createBuildings();
    scene.add(buildings);
    layerGroupsRef.current["facilities"] = buildings;

    // 해류
    const flow = createCurrentFlow();
    scene.add(flow);
    layerGroupsRef.current["currentFlow"] = flow;
  }

  // 레이어 토글
  useEffect(() => {
    const keys = ["bathymetry", "facilities", "currentFlow"];
    for (const key of keys) {
      const obj = layerGroupsRef.current[key];
      if (obj) {
        obj.visible = layers[key as keyof typeof layers] as boolean;
      }
    }
  }, [layers.bathymetry, layers.facilities, layers.currentFlow]);

  return <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}
