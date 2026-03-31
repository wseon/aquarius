"use client";

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useLayerStore } from "@/stores/layerStore";

Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN!;
(window as any).CESIUM_BASE_URL = "/cesium";

// 인천북항 중심 (교차로)
const PORT_CENTER = { lat: 37.47981, lon: 126.61953 };

// ROI 범위
const ROI = {
  north: 37.51254,
  south: 37.47991,
  west: 126.58342,
  east: 126.64548,
};

// 수심 → 색상 (레퍼런스 스타일: 깊은파랑 → 청록 → 초록 → 주황)
function depthColor(depth: number, maxD = 28): [number, number, number, number] {
  const t = Math.min(Math.max(depth / maxD, 0), 1);

  let r: number, g: number, b: number;
  if (t < 0.15) {
    // 해안가 (얕음) — 주황/갈색
    const s = t / 0.15;
    r = 0.9; g = 0.6 + s * 0.15; b = 0.2;
  } else if (t < 0.35) {
    // 얕은 바다 — 주황 → 초록
    const s = (t - 0.15) / 0.2;
    r = 0.9 - s * 0.6; g = 0.75 + s * 0.15; b = 0.2 + s * 0.1;
  } else if (t < 0.55) {
    // 중간 — 초록 → 청록
    const s = (t - 0.35) / 0.2;
    r = 0.3 - s * 0.2; g = 0.9 - s * 0.1; b = 0.3 + s * 0.4;
  } else if (t < 0.75) {
    // 깊은 곳 — 청록 → 파랑
    const s = (t - 0.55) / 0.2;
    r = 0.1 - s * 0.05; g = 0.8 - s * 0.4; b = 0.7 + s * 0.15;
  } else {
    // 심해 — 진한 파랑/남색
    const s = (t - 0.75) / 0.25;
    r = 0.05; g = 0.4 - s * 0.25; b = 0.85 - s * 0.15;
  }
  return [r, g, b, 0.85];
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const layerGroupsRef = useRef<Record<string, Cesium.Entity[]>>({});
  const layers = useLayerStore();
  const basemap = useLayerStore((s) => s.basemap);
  const timeHour = useLayerStore((s) => s.timeHour);
  const [clickCoord, setClickCoord] = useState<{ lat: number; lon: number } | null>(null);

  // Viewer 초기화
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      sceneModePicker: false,
      infoBox: true,
      selectionIndicator: true,
      creditContainer: document.createElement("div"), // 크레딧 숨김
    });

    viewerRef.current = viewer;

    // 기본 위성 레이어 제거 → OpenStreetMap 일반지도로 교체
    // 심플 지도 — 바다/육지 경계만 (CartoDB Voyager No Labels)
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png",
        credit: "CartoDB",
      })
    );

    // 지하(수중) 렌더링 허용
    viewer.scene.globe.depthTestAgainstTerrain = false;

    // OSM 3D Buildings — 비활성화 (Overture 건물만 사용)

    // 카메라: 이동/회전/줌 허용
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableTranslate = true;
    controller.enableRotate = true;
    controller.enableZoom = true;
    controller.enableTilt = true;
    controller.enableLook = false;
    // 줌 제한: 초기 높이를 최대로 고정
    controller.maximumZoomDistance = 4000;
    controller.enableZoom = false;

    // 휠 이벤트 직접 처리 — 줌인만 허용
    const canvas = viewer.scene.canvas;
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const carto = viewer.camera.positionCartographic;
      const currentHeight = carto.height;

      if (e.deltaY < 0) {
        // 줌인 (위로 스크롤)
        const newHeight = Math.max(currentHeight * 0.9, 200);
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            Cesium.Math.toDegrees(carto.longitude),
            Cesium.Math.toDegrees(carto.latitude),
            newHeight
          ),
          orientation: {
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll,
          },
        });
      } else if (e.deltaY > 0) {
        // 줌아웃 (아래로 스크롤) — 4000m 이하만
        const newHeight = Math.min(currentHeight * 1.1, 4000);
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            Cesium.Math.toDegrees(carto.longitude),
            Cesium.Math.toDegrees(carto.latitude),
            newHeight
          ),
          orientation: {
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll,
          },
        });
      }
    };
    canvas.addEventListener("wheel", wheelHandler, { passive: false });

    // 카메라 → 북항
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        PORT_CENTER.lon,
        PORT_CENTER.lat - 0.008,
        3000
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
    });

    // 클릭 핸들러
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    const pickLatLon = (px: Cesium.Cartesian2) => {
      const ray = viewer.camera.getPickRay(px);
      if (!ray) return null;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) return null;
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      return {
        lat: Cesium.Math.toDegrees(carto.latitude),
        lon: Cesium.Math.toDegrees(carto.longitude),
      };
    };

    // 좌표 표시
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const coord = pickLatLon(click.position);
      if (coord) setClickCoord(coord);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 데이터 로드
    loadAllLayers(viewer);

    return () => {
      canvas.removeEventListener("wheel", wheelHandler);
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // 베이스맵 전환
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.imageryLayers.removeAll();
    if (basemap === "satellite") {
      Cesium.IonImageryProvider.fromAssetId(2).then((provider) => {
        if (!viewer.isDestroyed()) {
          viewer.imageryLayers.addImageryProvider(provider);
        }
      });
    } else {
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: "https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
          credit: "CartoDB",
        })
      );
    }
  }, [basemap]);

  // 레이어 토글 반영
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const layerKeys = [
      "bathymetry",
      "currentFlow",
      "channels",
      "dangerZones",
      "facilities",
      "vessels",
      "waterSurface",
      "waterTemp",
      "salinity",
      "pollution",
    ];

    for (const key of layerKeys) {
      const entities = layerGroupsRef.current[key] || [];
      const visible = layers[key as keyof typeof layers] as boolean;
      for (const entity of entities) {
        entity.show = visible;
      }
    }

    // 수층별 필터 — 해류 화살표
    const depthFilter = layers.depthFilter;
    const flowEntities = layerGroupsRef.current["currentFlow"] || [];
    for (const e of flowEntities) {
      if (!layers.currentFlow) {
        e.show = false;
        continue;
      }
      const layer = (e as any).__depthLayer;
      if (!layer || depthFilter === "all") {
        e.show = true;
      } else if (depthFilter === "surface") {
        e.show = layer === "surface";
      } else if (depthFilter === "mid") {
        e.show = layer === "mid";
      } else if (depthFilter === "bottom") {
        e.show = layer === "bottom";
      }
    }

  }, [
    layers.bathymetry,
    layers.currentFlow,
    layers.channels,
    layers.dangerZones,
    layers.facilities,
    layers.vessels,
    layers.waterSurface,
    layers.waterTemp,
    layers.salinity,
    layers.pollution,
    layers.depthFilter,
  ]);

  // 시간 변경 시 해류 재로드
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // 기존 해류 엔티티 제거
    const oldFlow = layerGroupsRef.current["currentFlow"] || [];
    for (const e of oldFlow) viewer.entities.remove(e);

    loadCurrentFlow(viewer, timeHour);
  }, [timeHour]);

  async function loadAllLayers(viewer: Cesium.Viewer) {
    layerGroupsRef.current = {};

    await Promise.all([
      loadBathymetry(viewer),
      loadBuildings(viewer),
      loadChannels(viewer),
      loadDangerZones(viewer),
      loadFacilities(viewer),
      loadCurrentFlow(viewer, timeHour),
      loadWaterSurface(viewer),
      loadWaterTemp(viewer),
      loadSalinity(viewer),
      loadPollution(viewer),
    ]);
  }

  // --- 수심 레이어 (3D 메시 지형) ---
  async function loadBathymetry(viewer: Cesium.Viewer) {
    const res = await fetch("/api/bathymetry-mesh");
    const meshData = await res.json();
    if (viewer.isDestroyed()) return;

    const { lats, lons, grid } = meshData;
    if (!lats || !lons) return;

    const entities: Cesium.Entity[] = [];
    const depthScale = 8; // 높이 과장 배율 (입체감 강조)
    const maxDepth = 30;

    // 인접 4점으로 쿼드 생성 → perPositionHeight로 기울어진 면
    for (let i = 0; i < lats.length - 1; i++) {
      for (let j = 0; j < lons.length - 1; j++) {
        const lat0 = lats[i], lat1 = lats[i + 1];
        const lon0 = lons[j], lon1 = lons[j + 1];

        // 격자 간격이 너무 크면 스킵 (보간 빈틈 방지)
        if (lat1 - lat0 > 0.0004 || lon1 - lon0 > 0.0005) continue;

        const d00 = grid[`${lat0},${lon0}`];
        const d10 = grid[`${lat1},${lon0}`];
        const d01 = grid[`${lat0},${lon1}`];
        const d11 = grid[`${lat1},${lon1}`];

        // 4개 꼭지점 모두 있어야 함
        if (d00 == null || d10 == null || d01 == null || d11 == null) continue;

        const avgDepth = (d00 + d10 + d01 + d11) / 4;
        const [r, g, b, a] = depthColor(avgDepth, maxDepth);

        const e = viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights([
              lon0, lat0, -d00 * depthScale,
              lon1, lat0, -d10 * depthScale,
              lon1, lat1, -d11 * depthScale,
              lon0, lat1, -d01 * depthScale,
            ]),
            perPositionHeight: true,
            material: new Cesium.Color(r, g, b, a),
            outline: false,
          },
        });
        entities.push(e);
      }
    }

    layerGroupsRef.current["bathymetry"] = entities;
    console.log(`수심 3D 메시: ${entities.length}개 면`);
  }

  // --- 해류 흐름 (바다 영역, 시간에 따라 변화) ---
  async function loadCurrentFlow(viewer: Cesium.Viewer, hour: number = 0) {
    // 수심 데이터에서 바다 좌표 가져오기
    const bathRes = await fetch("/api/bathymetry");
    const bathData = await bathRes.json();
    if (viewer.isDestroyed()) return;

    const waterSet = new Set<string>();
    for (const p of bathData.points || []) {
      if (p.isWater) {
        // 0.002 단위로 그룹핑 (해류는 수심보다 큰 간격)
        const key = `${(Math.round(p.lat / 0.002) * 0.002).toFixed(3)},${(Math.round(p.lon / 0.002) * 0.002).toFixed(3)}`;
        waterSet.add(key);
      }
    }

    const entities: Cesium.Entity[] = [];
    // 시간에 따라 조류 방향/속도 변화 (6시간 주기 — 밀물/썰물)
    const tidePhase = Math.sin((hour / 6) * Math.PI);  // -1 ~ 1
    const baseDir = tidePhase > 0 ? 340 : 160;  // 밀물: 북서, 썰물: 남동
    const speedMult = 0.5 + Math.abs(tidePhase) * 0.7;

    const depthLayers = [
      { depth: 2, speed: 1.2 * speedMult, dir: baseDir, color: "#ffffff", label: "표층", width: 5, layer: "surface" },
      { depth: 8, speed: 0.8 * speedMult, dir: baseDir - 10, color: "#67e8f9", label: "중층", width: 4, layer: "mid" },
      { depth: 18, speed: 0.4 * speedMult, dir: baseDir - 20, color: "#22d3ee", label: "저층", width: 3, layer: "bottom" },
    ];

    for (const layer of depthLayers) {
      for (const key of waterSet) {
        const [latStr, lonStr] = key.split(",");
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);

        // 해저터널 동쪽은 스킵
        if (lon > 126.627) continue;

        const rad = (layer.dir * Math.PI) / 180;
        const arrowLen = 0.0012 * layer.speed;
        const endLat = lat + Math.cos(rad) * arrowLen;
        const endLon = lon + Math.sin(rad) * arrowLen;

        const e = viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              lon, lat, endLon, endLat,
            ]),
            width: layer.width,
            material: new Cesium.PolylineArrowMaterialProperty(
              Cesium.Color.fromCssColorString(layer.color).withAlpha(0.8)
            ),
            clampToGround: true,
          },
          name: `${layer.label} 해류 ${layer.speed}m/s`,
        });
        (e as any).__depthLayer = layer.layer;
        entities.push(e);
      }
    }
    layerGroupsRef.current["currentFlow"] = entities;
    console.log(`해류 벡터: ${entities.length}개`);
  }

  // --- 항로/정박지 (ROI 바다 영역 기준) ---
  async function loadChannels(viewer: Cesium.Viewer) {
    const entities: Cesium.Entity[] = [];

    // 인천항 주항로 (남북 방향, 바다 중앙)
    const e1 = viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
          126.610, 37.480, 126.608, 37.485, 126.606, 37.490,
          126.605, 37.495, 126.604, 37.500, 126.603, 37.505,
          126.602, 37.510,
        ]),
        width: 10,
        material: Cesium.Color.fromCssColorString("#3b82f6").withAlpha(0.35),
        clampToGround: true,
      },
      name: "주항로",
    });
    entities.push(e1);

    // 보조항로 (서쪽)
    const e2 = viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
          126.595, 37.482, 126.594, 37.488, 126.593, 37.494,
          126.592, 37.500, 126.592, 37.506,
        ]),
        width: 6,
        material: Cesium.Color.fromCssColorString("#3b82f6").withAlpha(0.25),
        clampToGround: true,
      },
      name: "보조항로",
    });
    entities.push(e2);

    // 정박지 A (항로 서쪽)
    const anch1 = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(126.590, 37.492, 0),
      ellipse: {
        semiMajorAxis: 250,
        semiMinorAxis: 180,
        material: Cesium.Color.fromCssColorString("#8b5cf6").withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#8b5cf6").withAlpha(0.4),
      },
      name: "정박지 A",
      label: {
        text: "정박지 A",
        font: "11px sans-serif",
        fillColor: Cesium.Color.fromCssColorString("#8b5cf6"),
        style: Cesium.LabelStyle.FILL,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entities.push(anch1);

    // 정박지 B (항만 앞)
    const anch2 = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(126.600, 37.503, 0),
      ellipse: {
        semiMajorAxis: 200,
        semiMinorAxis: 150,
        material: Cesium.Color.fromCssColorString("#8b5cf6").withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#8b5cf6").withAlpha(0.4),
      },
      name: "정박지 B",
      label: {
        text: "정박지 B",
        font: "11px sans-serif",
        fillColor: Cesium.Color.fromCssColorString("#8b5cf6"),
        style: Cesium.LabelStyle.FILL,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entities.push(anch2);

    layerGroupsRef.current["channels"] = entities;
  }

  // --- 위험구역 (ROI 바다 영역 기준) ---
  async function loadDangerZones(viewer: Cesium.Viewer) {
    const entities: Cesium.Entity[] = [];

    const zones = [
      {
        name: "위험구역 A (얕은 수심)",
        coords: [126.610, 37.486, 126.618, 37.486, 126.618, 37.490, 126.610, 37.490],
        color: "#ef4444",
      },
      {
        name: "위험구역 B (조류 위험)",
        coords: [126.598, 37.496, 126.606, 37.496, 126.606, 37.500, 126.598, 37.500],
        color: "#f97316",
      },
      {
        name: "위험구역 C (통항 혼잡)",
        coords: [126.602, 37.505, 126.610, 37.505, 126.610, 37.509, 126.602, 37.509],
        color: "#eab308",
      },
    ];

    for (const zone of zones) {
      const e = viewer.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(zone.coords),
          height: 1,
          material: Cesium.Color.fromCssColorString(zone.color).withAlpha(0.15),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(zone.color).withAlpha(0.6),
        },
        name: zone.name,
        label: {
          text: zone.name,
          font: "10px sans-serif",
          fillColor: Cesium.Color.fromCssColorString(zone.color),
          style: Cesium.LabelStyle.FILL,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entities.push(e);
    }
    layerGroupsRef.current["dangerZones"] = entities;
  }

  // --- 건물 3D ---
  async function loadBuildings(viewer: Cesium.Viewer) {
    const res = await fetch("/api/buildings");
    const geojson = await res.json();
    if (viewer.isDestroyed()) return;

    const entities: Cesium.Entity[] = [];
    const COLORS: Record<string, string> = {
      industrial: "#6a7a8a",
      warehouse: "#7a8595",
      storage_tank: "#8a7a65",
    };

    for (const feature of geojson.features) {
      const height = feature.properties.height || 8;
      const bt = feature.properties.building || "warehouse";
      const color = COLORS[bt] || "#7a8090";
      const geomType = feature.geometry.type;

      // Polygon과 MultiPolygon 모두 처리
      const rings: number[][][] =
        geomType === "MultiPolygon"
          ? feature.geometry.coordinates.map((p: number[][][]) => p[0])
          : [feature.geometry.coordinates[0]];

      for (const ring of rings) {
        if (!ring || !Array.isArray(ring[0])) continue;
        const positions: number[] = [];
        for (const coord of ring) {
          if (typeof coord[0] === "number" && typeof coord[1] === "number") {
            positions.push(coord[0], coord[1]);
          }
        }
        if (positions.length < 6) continue;

        const e = viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            extrudedHeight: height,
            extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            material: Cesium.Color.fromCssColorString(color).withAlpha(0.9),
            outline: true,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.15),
          },
          name: feature.properties.name || bt,
        });
        entities.push(e);
      }
    }
    layerGroupsRef.current["facilities"] = entities;
  }

  // --- 항만시설 glTF (추후 정밀 모델 배치) ---
  async function loadFacilities(_viewer: Cesium.Viewer) {
    // facilities 레이어는 loadBuildings에서 처리
  }

  // --- 해수면 ---
  async function loadWaterSurface(viewer: Cesium.Viewer) {
    const entities: Cesium.Entity[] = [];
    const e = viewer.entities.add({
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          126.583, 37.480, 126.627, 37.480,
          126.627, 37.513, 126.583, 37.513,
        ]),
        height: 0,
        material: Cesium.Color.fromCssColorString("#0c4a6e").withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#0ea5e9").withAlpha(0.3),
      },
      name: "해수면",
    });
    entities.push(e);
    layerGroupsRef.current["waterSurface"] = entities;
  }

  // --- 수온 레이어 (모의) ---
  async function loadWaterTemp(viewer: Cesium.Viewer) {
    const bathRes = await fetch("/api/bathymetry");
    const bathData = await bathRes.json();
    if (viewer.isDestroyed()) return;

    const entities: Cesium.Entity[] = [];
    const halfLat = 0.001;
    const halfLon = 0.00125;

    // 0.002 간격으로 샘플링 (수심보다 성긴 격자)
    const sampled = new Map<string, { lat: number; lon: number }>();
    for (const p of bathData.points || []) {
      if (!p.isWater) continue;
      const key = `${(Math.round(p.lat / 0.002) * 0.002).toFixed(3)},${(Math.round(p.lon / 0.002) * 0.002).toFixed(3)}`;
      if (!sampled.has(key)) sampled.set(key, { lat: p.lat, lon: p.lon });
    }

    for (const [, p] of sampled) {
      if (p.lon > 126.627) continue;
      // 수온: 11~14도 범위 (위도/경도에 따라 변화)
      const temp = 11 + Math.sin(p.lat * 5000) * 1.5 + Math.cos(p.lon * 4000) * 1.0 + 1.5;
      const t = (temp - 10) / 5; // 0~1 정규화
      const color = new Cesium.Color(t, 0.3, 1.0 - t, 0.4);

      const e = viewer.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            p.lon - halfLon, p.lat - halfLat,
            p.lon + halfLon, p.lat - halfLat,
            p.lon + halfLon, p.lat + halfLat,
            p.lon - halfLon, p.lat + halfLat,
          ]),
          height: 1,
          material: color,
          outline: false,
        },
        name: `수온 ${temp.toFixed(1)}°C`,
        show: false, // 기본 비활성
      });
      entities.push(e);
    }
    layerGroupsRef.current["waterTemp"] = entities;
  }

  // --- 염분 레이어 (모의) ---
  async function loadSalinity(viewer: Cesium.Viewer) {
    const bathRes = await fetch("/api/bathymetry");
    const bathData = await bathRes.json();
    if (viewer.isDestroyed()) return;

    const entities: Cesium.Entity[] = [];
    const halfLat = 0.001;
    const halfLon = 0.00125;

    const sampled = new Map<string, { lat: number; lon: number }>();
    for (const p of bathData.points || []) {
      if (!p.isWater) continue;
      const key = `${(Math.round(p.lat / 0.002) * 0.002).toFixed(3)},${(Math.round(p.lon / 0.002) * 0.002).toFixed(3)}`;
      if (!sampled.has(key)) sampled.set(key, { lat: p.lat, lon: p.lon });
    }

    for (const [, p] of sampled) {
      if (p.lon > 126.627) continue;
      // 염분: 30~33 PSU (해안 가까울수록 낮음)
      const sal = 30 + Math.sin(p.lon * 8000) * 1.5 + Math.cos(p.lat * 6000) * 1.0 + 1.5;
      const t = (sal - 29) / 5;
      const color = new Cesium.Color(0.2, t, 0.8, 0.4);

      const e = viewer.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            p.lon - halfLon, p.lat - halfLat,
            p.lon + halfLon, p.lat - halfLat,
            p.lon + halfLon, p.lat + halfLat,
            p.lon - halfLon, p.lat + halfLat,
          ]),
          height: 1.5,
          material: color,
          outline: false,
        },
        name: `염분 ${sal.toFixed(1)} PSU`,
        show: false,
      });
      entities.push(e);
    }
    layerGroupsRef.current["salinity"] = entities;
  }

  // --- 오염 확산 시뮬레이션 (파티클 기반) ---
  async function loadPollution(viewer: Cesium.Viewer) {
    const entities: Cesium.Entity[] = [];

    // 오염원 위치 (가상 — 북항 부두 앞 유류 유출)
    const sourceLatLon = { lat: 37.497, lon: 126.615 };
    const maxRadius = 0.008; // 확산 반경 (도)
    const numParticles = 80;

    for (let i = 0; i < numParticles; i++) {
      // 오염원에서 방사형 확산 (랜덤 각도/거리)
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * maxRadius * Math.sqrt(Math.random()); // 중심에 밀집
      const lat = sourceLatLon.lat + Math.sin(angle) * dist;
      const lon = sourceLatLon.lon + Math.cos(angle) * dist * 1.2; // 경도 보정

      // 농도: 중심에 가까울수록 높음
      const concentration = 1 - (dist / maxRadius);
      const size = 30 + concentration * 70;

      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 2),
        ellipse: {
          semiMajorAxis: size,
          semiMinorAxis: size * 0.8,
          material: Cesium.Color.fromCssColorString("#8b0000").withAlpha(concentration * 0.5),
          outline: false,
          height: 2,
        },
        name: `오염 농도 ${(concentration * 100).toFixed(0)}%`,
        show: false,
      });
      entities.push(e);
    }

    // 오염원 마커
    const marker = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(sourceLatLon.lon, sourceLatLon.lat, 5),
      point: {
        pixelSize: 12,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: "유류 유출 지점",
        font: "12px sans-serif",
        fillColor: Cesium.Color.RED,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -15),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      name: "오염원",
      show: false,
    });
    entities.push(marker);

    layerGroupsRef.current["pollution"] = entities;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      {/* 클릭 좌표 */}
      {clickCoord && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#0a0f1a]/90 border border-gray-700/50 px-3 py-1 rounded font-mono text-xs text-yellow-400 z-20">
          {clickCoord.lat.toFixed(5)}, {clickCoord.lon.toFixed(5)}
        </div>
      )}
    </>
  );
}
