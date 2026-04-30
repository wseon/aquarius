"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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
import { PollutionSystem } from "./three/Pollution";
import { createPollutionZones } from "./three/PollutionZone";
import OceanInfoPopup from "./ui/OceanInfoPopup";
import Compass, { compassCameraRef, compassResetRef } from "./ui/Compass";
import { createWaterSurface } from "./three/WaterSurface";

export default function ThreeMapView() {
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadLabel, setLoadLabel] = useState("초기화 중...");
  const [loaded, setLoaded] = useState(false);
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
  const pollutionRef = useRef<PollutionSystem | null>(null);
  const pollutionZoneAnimateRef = useRef<(() => void) | null>(null);
  const [pollutionMode, setPollutionMode] = useState<"off" | "marine" | "air">("off");
  const pollutionModeRef = useRef<"off" | "marine" | "air">("off");
  const [marineCount, setMarineCount] = useState(0);
  const [airCount, setAirCount] = useState(0);
  const [buildingInfo, setBuildingInfo] = useState<{
    type: string;
    height: number;
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [vesselInfo, setVesselInfo] = useState<{
    data: any;
    x: number;
    y: number;
  } | null>(null);
  const [oceanInfo, setOceanInfo] = useState<{
    depth: number;
    currents: { layer: string; speed: number; direction: number }[];
    x: number;
    y: number;
  } | null>(null);
  const selectedBuildingRef = useRef<{ mesh: THREE.Mesh; originalColor: THREE.Color } | null>(null);
  const layers = useLayerStore();

  useEffect(() => { pollutionModeRef.current = pollutionMode; }, [pollutionMode]);
  const totalPollution = marineCount + airCount;
  const timeHour = useLayerStore((s) => s.timeHour);
  const tideOffsetsRef = useRef<Record<number, number>>({});
  const setTideOffsetRef = useRef<((offset: number) => void) | null>(null);

  useEffect(() => {
    if (setTideOffsetRef.current && timeHour in tideOffsetsRef.current) {
      setTideOffsetRef.current(tideOffsetsRef.current[timeHour]);
    }
    if (currentVecRef.current) {
      currentVecRef.current.setHour(timeHour);
    }
  }, [timeHour]);

  // 낮/밤 모드 — 비활성 (비교용)

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
    // scene.fog = new THREE.Fog(0x1a2030, 5000, 12000);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      100000
    );
    camera.position.set(0, 2500, 2000); // 초기값, 아래에서 덮어씀
    cameraRef.current = camera;

    // 직접 카메라 컨트롤
    const canvas = renderer.domElement;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // 궤도 카메라 상태 (초기값)
    const INIT_TARGET = new THREE.Vector3(-1524, 0, -6815);
    const INIT_SPHERICAL = { radius: 9740, phi: 0.948, theta: -3.728 };
    const target = INIT_TARGET.clone();
    let spherical = new THREE.Spherical(INIT_SPHERICAL.radius, INIT_SPHERICAL.phi, INIT_SPHERICAL.theta);

    // 나침반 리셋 함수 등록
    compassResetRef.current = () => {
      target.copy(INIT_TARGET);
      spherical.set(INIT_SPHERICAL.radius, INIT_SPHERICAL.phi, INIT_SPHERICAL.theta);
      updateCamera();
    };
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

    // Raycaster (건물 클릭 감지)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    canvas.addEventListener("pointerdown", (e) => {
      isDragging = true;
      dragButton = e.button;
      lastX = e.clientX;
      lastY = e.clientY;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      // 드래그 시작하면 팝업 제거
      setBuildingInfo(null);
      setVesselInfo(null);
      setOceanInfo(null);
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (dragButton === 0) {
        // 좌클릭 → 이동
        const panSpeed = spherical.radius * 0.001;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        right.crossVectors(camera.getWorldDirection(new THREE.Vector3()), up).normalize();
        const forward = new THREE.Vector3();
        forward.crossVectors(up, right).normalize();
        target.add(right.multiplyScalar(-dx * panSpeed));
        target.add(forward.multiplyScalar(dy * panSpeed));
        updateCamera();
      } else if (dragButton === 2) {
        // 우클릭 → 회전
        spherical.theta -= dx * 0.005;
        spherical.phi -= dy * 0.005;
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.1, spherical.phi));
        updateCamera();
      }
    });

    canvas.addEventListener("pointerup", (e) => {
      isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
      console.log(`CAM target(${target.x.toFixed(0)},${target.y.toFixed(0)},${target.z.toFixed(0)}) radius:${spherical.radius.toFixed(0)} theta:${spherical.theta.toFixed(3)} phi:${spherical.phi.toFixed(3)}`);

      // 클릭 판별 (이동 5px 미만이면 클릭)
      const ddx = e.clientX - pointerDownPos.x;
      const ddy = e.clientY - pointerDownPos.y;
      const isClick = Math.sqrt(ddx * ddx + ddy * ddy) < 5 && e.button === 0;
      const mode = pollutionModeRef.current;

      // 일반 클릭 — 건물 정보 표시 + 하이라이트
      if (isClick && mode === "off") {
        // 이전 하이라이트 복원
        if (selectedBuildingRef.current) {
          const prev = selectedBuildingRef.current;
          const mat = prev.mesh.material as THREE.MeshPhongMaterial;
          mat.color.copy(prev.originalColor);
          mat.emissive.setHex(0x000000);
          selectedBuildingRef.current = null;
        }

        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        setVesselInfo(null);
        setBuildingInfo(null);
        setOceanInfo(null);

        // 선박 체크
        const vessels = layerGroupsRef.current["vessels"];
        if (vessels) {
          const vIntersects = raycaster.intersectObjects(vessels.children, true);
          if (vIntersects.length > 0) {
            // vesselRoot 찾기
            let obj: THREE.Object3D | null = vIntersects[0].object;
            while (obj && !obj.userData.vesselData) {
              obj = obj.userData.vesselRoot || obj.parent;
            }
            if (obj?.userData.vesselData) {
              setVesselInfo({ data: obj.userData.vesselData, x: e.clientX, y: e.clientY });
              return; // 선박 히트 시 건물 체크 스킵
            }
          }
        }

        // 건물 체크
        const buildings = layerGroupsRef.current["facilities"];
        if (buildings) {
          const intersects = raycaster.intersectObjects(buildings.children, true);
          if (intersects.length > 0) {
            const hit = intersects[0].object as THREE.Mesh;
            const ud = hit.userData;

            const mat = hit.material as THREE.MeshPhongMaterial;
            const origColor = mat.color.clone();
            mat.color.set(0xcc3333);
            mat.emissive.set(0x441111);
            selectedBuildingRef.current = { mesh: hit, originalColor: origColor };

            setBuildingInfo({
              type: ud.buildingType || "unknown",
              height: ud.buildingHeight || 0,
              name: ud.buildingName || "",
              x: e.clientX,
              y: e.clientY,
            });
            return;
          }
        }

        // 바다 체크 — 지형 클릭 (Y < 0 = 바다)
        const terrain = layerGroupsRef.current["seabed"] || layerGroupsRef.current["surfaceTerrain"];
        if (terrain) {
          const intersects = raycaster.intersectObjects(terrain.children, true);
          if (intersects.length > 0) {
            const hit = intersects[0].point;
            if (hit.y < 0 && currentVecRef.current) {
              const currents = currentVecRef.current.queryAtPosition(hit.x, hit.z);
              if (currents) {
                // 수심 추정 (Y 좌표 기반, DEPTH_SCALE=5)
                const depth = Math.abs(hit.y) / 5;
                setOceanInfo({
                  depth: Math.round(depth * 10) / 10,
                  currents,
                  x: e.clientX,
                  y: e.clientY,
                });
              }
            }
          }
        }
      }

      if (isClick && mode !== "off") {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        if (mode === "air") {
          // 대기 오염 — 건물 클릭
          const buildings = layerGroupsRef.current["facilities"];
          if (buildings) {
            const intersects = raycaster.intersectObjects(buildings.children, true);
            if (intersects.length > 0 && pollutionRef.current) {
              pollutionRef.current.addAirSource(intersects[0].point);
              setAirCount(pollutionRef.current.getCount("air"));
              pollutionRef.current.group.visible = true;
            }
          }
        } else if (mode === "marine") {
          // 해양 오염 — 지형(바다) 클릭
          const terrain = layerGroupsRef.current["seabed"] || layerGroupsRef.current["surfaceTerrain"];
          if (terrain) {
            const intersects = raycaster.intersectObjects(terrain.children, true);
            if (intersects.length > 0 && pollutionRef.current) {
              const hit = intersects[0].point;
              // Y < 0 이면 바다 영역
              if (hit.y < 0) {
                pollutionRef.current.addMarineSource(hit);
                setMarineCount(pollutionRef.current.getCount("marine"));
                pollutionRef.current.group.visible = true;
              }
            }
          }
        }
      }
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      spherical.radius = Math.max(50, Math.min(50000, spherical.radius * zoomFactor));
      updateCamera();
      console.log(`CAM target(${target.x.toFixed(0)},${target.y.toFixed(0)},${target.z.toFixed(0)}) radius:${spherical.radius.toFixed(0)} theta:${spherical.theta.toFixed(3)} phi:${spherical.phi.toFixed(3)}`);
    }, { passive: false });


    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(500, 1000, 500);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.5);
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
      if (pollutionRef.current) pollutionRef.current.animate();
      if (pollutionZoneAnimateRef.current) pollutionZoneAnimateRef.current();
      // 나침반 heading 업데이트
      compassCameraRef.current = camera;
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
    setLoadLabel("지형 데이터 로딩...");
    setLoadProgress(5);
    const wmRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/terrain-watermap`);
    const wmData = await wmRes.json();

    setLoadLabel("지형 메시 생성...");
    setLoadProgress(15);
    const { seabedMesh, surfaceMesh, animateSurface, setTideOffset } = await createTerrainMesh();
    scene.add(seabedMesh);
    scene.add(surfaceMesh);
    layerGroupsRef.current["seabed"] = seabedMesh;
    layerGroupsRef.current["surfaceTerrain"] = surfaceMesh;
    waterAnimateRef.current = animateSurface;
    setTideOffsetRef.current = setTideOffset;
    surfaceMesh.visible = false;

    try {
      const tideRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/tide`);
      const tideData = await tideRes.json();
      const records = tideData.records || [];
      const levels = records.map((r: any) => r.measured || r.predicted || 0);
      const msl = levels.length > 0 ? levels.reduce((a: number, b: number) => a + b, 0) / levels.length : 0;
      for (const r of records) {
        const hour = parseInt(r.datetime.split(" ")[1].split(":")[0]);
        const level = r.measured || r.predicted || msl;
        tideOffsetsRef.current[hour] = (level - msl) / 100;
      }
      setTideOffset(tideOffsetsRef.current[12] || 0);
    } catch {}
    setLoadProgress(35);

    setLoadLabel("건물 로딩...");
    const buildings = await createBuildings();
    scene.add(buildings);
    layerGroupsRef.current["facilities"] = buildings;
    setLoadProgress(55);

    setLoadLabel("해류 데이터 로딩...");
    const currentVec = new CurrentVectorSystem();
    await currentVec.load();
    scene.add(currentVec.group);
    currentVecRef.current = currentVec;
    layerGroupsRef.current["currentFlow"] = currentVec.group;
    setLoadProgress(70);

    setLoadLabel("선박 로딩...");
    const { group: vesselGroup, animate: vesselAnimate } = await createVessels();
    scene.add(vesselGroup);
    vesselAnimateRef.current = vesselAnimate;
    layerGroupsRef.current["vessels"] = vesselGroup;
    setLoadProgress(80);

    setLoadLabel("항로/위험구역 로딩...");
    const { group: channelGroup, animate: channelAnimate } = createChannels();
    scene.add(channelGroup);
    channelAnimateRef.current = channelAnimate;
    layerGroupsRef.current["channels"] = channelGroup;

    const { group: dangerGroup, animate: dangerAnimate, checkVesselInZone, setAlert } = createDangerZones();
    scene.add(dangerGroup);
    dangerAnimateRef.current = dangerAnimate;
    dangerCheckRef.current = { check: checkVesselInZone, setAlert };
    layerGroupsRef.current["dangerZones"] = dangerGroup;
    setLoadProgress(90);

    setLoadLabel("오염 확산 시스템 초기화...");
    const pollution = new PollutionSystem();
    await pollution.loadCurrentData(12);
    scene.add(pollution.group);
    pollutionRef.current = pollution;
    layerGroupsRef.current["pollution"] = pollution.group;
    pollution.group.visible = false;


    // 오염구역 레이어
    const { group: pzGroup, animate: pzAnimate } = createPollutionZones(buildings);
    scene.add(pzGroup);
    layerGroupsRef.current["pollutionZone"] = pzGroup;
    pollutionZoneAnimateRef.current = pzAnimate;
    pzGroup.visible = false;

    setLoadProgress(100);
    setLoadLabel("완료");
    setTimeout(() => setLoaded(true), 500);
  }

  // 레이어 토글
  useEffect(() => {
    const keys = ["facilities", "grid", "currentFlow", "vessels", "channels", "dangerZones", "pollution", "pollutionZone"];
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
  }, [layers.facilities, layers.grid, layers.seabed, layers.currentFlow, layers.vessels, layers.channels, layers.dangerZones, layers.pollution, layers.pollutionZone]);

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080c14] z-50">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white mb-4">관제시스템</h2>
            <div className="w-72 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{loadLabel} ({loadProgress}%)</p>
          </div>
        </div>
      )}

      {/* 건물 정보 팝업 */}
      {buildingInfo && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{ left: buildingInfo.x + 12, top: buildingInfo.y - 60 }}
        >
          <div className="bg-[#0a0f1a]/95 border border-gray-600/50 rounded-lg px-3 py-2 shadow-lg min-w-[140px]">
            {buildingInfo.name && (
              <p className="text-xs font-bold text-white mb-1">{buildingInfo.name}</p>
            )}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">유형</span>
                <span className="text-gray-300">{buildingInfo.type}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">높이</span>
                <span className="text-gray-300">{buildingInfo.height}m</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 선박 AIS 정보 팝업 */}
      {vesselInfo && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{ left: vesselInfo.x + 12, top: vesselInfo.y - 180 }}
        >
          <div className="bg-[#0a0f1a]/95 border border-cyan-600/50 rounded-lg px-3 py-2 shadow-lg min-w-[200px]">
            <div className="flex items-center gap-2 mb-1.5 border-b border-gray-700/50 pb-1.5">
              <span className="text-xs font-bold text-cyan-400">{vesselInfo.data.name}</span>
              <span className="text-[9px] text-gray-500">({vesselInfo.data.flag})</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
              <div className="flex justify-between"><span className="text-gray-500">MMSI</span><span className="text-gray-300">{vesselInfo.data.mmsi}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">호출부호</span><span className="text-gray-300">{vesselInfo.data.callSign}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">선종</span><span className="text-gray-300">{vesselInfo.data.type} ({vesselInfo.data.typeCode})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">상태</span><span className="text-gray-300">{vesselInfo.data.status}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">SOG</span><span className="text-gray-300">{vesselInfo.data.sog} kn</span></div>
              <div className="flex justify-between"><span className="text-gray-500">COG</span><span className="text-gray-300">{vesselInfo.data.cog}°</span></div>
              <div className="flex justify-between"><span className="text-gray-500">선수방향</span><span className="text-gray-300">{vesselInfo.data.heading}°</span></div>
              <div className="flex justify-between"><span className="text-gray-500">흘수</span><span className="text-gray-300">{vesselInfo.data.draft}m</span></div>
              <div className="flex justify-between"><span className="text-gray-500">길이/폭</span><span className="text-gray-300">{vesselInfo.data.length}m/{vesselInfo.data.width}m</span></div>
              <div className="flex justify-between"><span className="text-gray-500">위치</span><span className="text-gray-300">{vesselInfo.data.lat.toFixed(4)},{vesselInfo.data.lon.toFixed(4)}</span></div>
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-gray-700/50 text-[10px]">
              <div className="flex justify-between"><span className="text-gray-500">목적지</span><span className="text-gray-300">{vesselInfo.data.destination}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ETA</span><span className="text-gray-300">{vesselInfo.data.eta}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* 바다 해류 정보 팝업 */}
      {oceanInfo && <OceanInfoPopup info={oceanInfo} />}

      {/* 나침반 */}
      {loaded && <Compass />}

      {/* 오염원 지정 모드 */}
      {loaded && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          <button
            onClick={() => setPollutionMode(pollutionMode === "marine" ? "off" : "marine")}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              pollutionMode === "marine"
                ? "bg-red-500/30 border-red-500 text-red-300"
                : "bg-[#0a0f1a]/90 border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            {pollutionMode === "marine" ? "바다를 클릭..." : "해양 오염"}
          </button>

          <button
            onClick={() => setPollutionMode(pollutionMode === "air" ? "off" : "air")}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              pollutionMode === "air"
                ? "bg-gray-400/30 border-gray-400 text-gray-200"
                : "bg-[#0a0f1a]/90 border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            {pollutionMode === "air" ? "건물을 클릭..." : "대기 오염"}
          </button>

          {totalPollution > 0 && (
            <>
              <span className="text-[10px] text-gray-400">
                {marineCount > 0 && <span className="text-red-400">해양 {marineCount}</span>}
                {marineCount > 0 && airCount > 0 && " / "}
                {airCount > 0 && <span className="text-gray-300">대기 {airCount}</span>}
              </span>
              <button
                onClick={() => {
                  if (pollutionRef.current) {
                    pollutionRef.current.removeAll();
                    setMarineCount(0);
                    setAirCount(0);
                  }
                }}
                className="px-2 py-1 text-[10px] bg-gray-800 border border-gray-700 text-gray-400 rounded hover:text-white"
              >
                초기화
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
