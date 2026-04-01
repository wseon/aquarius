"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
// OrbitControls 대신 직접 카메라 컨트롤 구현
import { useLayerStore } from "@/stores/layerStore";
import { createMapTile } from "./three/MapTile";
import { createTerrainMesh } from "./three/TerrainMesh";
import { createBuildings } from "./three/Buildings";
import { CurrentVectorSystem } from "./three/CurrentVectors";
import { createVessels } from "./three/Vessels";
import { createChannels } from "./three/Channels";
import { createDangerZones } from "./three/DangerZones";
import { createPollution } from "./three/Pollution";
import { createWaterSurface } from "./three/WaterSurface";

export default function ThreeMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const layerGroupsRef = useRef<Record<string, THREE.Object3D>>({});
  const waterAnimateRef = useRef<(() => void) | null>(null);
  const currentVecRef = useRef<CurrentVectorSystem | null>(null);
  const vesselAnimateRef = useRef<(() => void) | null>(null);
  const channelAnimateRef = useRef<(() => void) | null>(null);
  const dangerAnimateRef = useRef<(() => void) | null>(null);
  const dangerCheckRef = useRef<{ check: (x: number, z: number) => boolean; setAlert: (a: boolean) => void } | null>(null);
  const pollutionAnimateRef = useRef<(() => void) | null>(null);
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
        target.add(right.multiplyScalar(dx * panSpeed));
        target.add(forward.multiplyScalar(dy * panSpeed));
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
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      spherical.radius = Math.max(200, Math.min(5000, spherical.radius * zoomFactor));
      updateCamera();
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
    gridHelper.position.y = -21;
    scene.add(gridHelper);
    layerGroupsRef.current["grid"] = gridHelper;

    // 데이터 로드
    loadAll(scene);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (waterAnimateRef.current) waterAnimateRef.current();
      if (currentVecRef.current) currentVecRef.current.animate();
      if (vesselAnimateRef.current) vesselAnimateRef.current();
      if (channelAnimateRef.current) channelAnimateRef.current();

      // 선박-위험구역 충돌 감지
      if (dangerCheckRef.current && layerGroupsRef.current["vessels"]) {
        let anyInZone = false;
        const vesselGroup = layerGroupsRef.current["vessels"] as THREE.Group;
        for (const child of vesselGroup.children) {
          if (dangerCheckRef.current.check(child.position.x, child.position.z)) {
            anyInZone = true;
            break;
          }
        }
        dangerCheckRef.current.setAlert(anyInZone);
      }
      if (dangerAnimateRef.current) dangerAnimateRef.current();
      if (pollutionAnimateRef.current) pollutionAnimateRef.current();
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
    // 지형 데이터 로드
    const wmRes = await fetch("/api/terrain-watermap");
    const wmData = await wmRes.json();

    // 지형 메시 2종
    const { seabedMesh, surfaceMesh, animateSurface } = await createTerrainMesh();
    scene.add(seabedMesh);   // 육지 + 해저지형
    scene.add(surfaceMesh);  // 육지 + 해수면
    layerGroupsRef.current["seabed"] = seabedMesh;
    layerGroupsRef.current["surfaceTerrain"] = surfaceMesh;
    waterAnimateRef.current = animateSurface;
    // 기본: seabed ON → surfaceMesh OFF
    surfaceMesh.visible = false;

    // 건물 (육지 위)
    const buildings = await createBuildings();
    scene.add(buildings);
    layerGroupsRef.current["facilities"] = buildings;

    // 해류 벡터
    const currentVec = new CurrentVectorSystem();
    await currentVec.load();
    scene.add(currentVec.group);
    currentVecRef.current = currentVec;
    layerGroupsRef.current["currentFlow"] = currentVec.group;

    // 선박
    const { group: vesselGroup, animate: vesselAnimate } = await createVessels();
    scene.add(vesselGroup);
    vesselAnimateRef.current = vesselAnimate;
    layerGroupsRef.current["vessels"] = vesselGroup;

    // 항로/정박지
    const { group: channelGroup, animate: channelAnimate } = createChannels();
    scene.add(channelGroup);
    channelAnimateRef.current = channelAnimate;
    layerGroupsRef.current["channels"] = channelGroup;

    // 위험구역
    const { group: dangerGroup, animate: dangerAnimate, checkVesselInZone, setAlert } = createDangerZones();
    scene.add(dangerGroup);
    dangerAnimateRef.current = dangerAnimate;
    dangerCheckRef.current = { check: checkVesselInZone, setAlert };
    layerGroupsRef.current["dangerZones"] = dangerGroup;

    // 오염 확산
    const { group: pollutionGroup, animate: pollutionAnimate } = createPollution();
    scene.add(pollutionGroup);
    pollutionAnimateRef.current = pollutionAnimate;
    layerGroupsRef.current["pollution"] = pollutionGroup;
    pollutionGroup.visible = false; // 기본 OFF
  }

  // 레이어 토글
  useEffect(() => {
    const keys = ["facilities", "grid", "currentFlow", "vessels", "channels", "dangerZones", "pollution"];
    for (const key of keys) {
      const obj = layerGroupsRef.current[key];
      if (obj) {
        obj.visible = layers[key as keyof typeof layers] as boolean;
      }
    }

    // seabed 토글: ON=육지+해저지형, OFF=육지+해수면
    const seabedObj = layerGroupsRef.current["seabed"];
    const surfaceObj = layerGroupsRef.current["surfaceTerrain"];
    if (seabedObj) seabedObj.visible = layers.seabed;
    if (surfaceObj) surfaceObj.visible = !layers.seabed;

    // 해류: 중층/저층은 해저지형 ON일 때만
    if (currentVecRef.current) {
      currentVecRef.current.setSeabedVisible(layers.seabed);
    }
  }, [layers.facilities, layers.grid, layers.seabed, layers.currentFlow, layers.vessels, layers.channels, layers.dangerZones, layers.pollution]);

  return <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}
