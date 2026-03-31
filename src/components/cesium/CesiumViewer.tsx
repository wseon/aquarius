"use client";

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import TidePanel from "@/components/dashboard/TidePanel";
import DepthLegend from "@/components/dashboard/DepthLegend";
import type { DepthPoint } from "@/lib/api";

// Cesium Ion 설정
Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN!;
(window as any).CESIUM_BASE_URL = "/cesium";

// 인천북항 해역 경계 폴리곤 (육지 제외)
const WATER_BOUNDARY: [number, number][] = [
  [126.575, 37.435],  // 남서
  [126.600, 37.435],  // 남동 (항로)
  [126.608, 37.445],  // 부두 남단
  [126.610, 37.455],  // 부두 중앙
  [126.608, 37.465],  // 부두 북단
  [126.603, 37.475],  // 내항
  [126.598, 37.485],  // 북서
  [126.575, 37.485],  // 북서 끝
];

// Point-in-polygon (ray casting)
function isInWater(lon: number, lat: number): boolean {
  const poly = WATER_BOUNDARY;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// 수심 → 색상 매핑 (얕은→깊은: 빨강→파랑)
function depthToColor(depth: number): Cesium.Color {
  const maxDepth = 28;
  const ratio = Math.min(Math.max(depth / maxDepth, 0), 1);

  if (ratio < 0.2) {
    const t = ratio / 0.2;
    return new Cesium.Color(1.0, t * 0.5, 0.0, 0.85);
  } else if (ratio < 0.4) {
    const t = (ratio - 0.2) / 0.2;
    return new Cesium.Color(1.0, 0.5 + t * 0.5, 0.0, 0.85);
  } else if (ratio < 0.6) {
    const t = (ratio - 0.4) / 0.2;
    return new Cesium.Color(1.0 - t, 1.0, 0.0, 0.85);
  } else if (ratio < 0.8) {
    const t = (ratio - 0.6) / 0.2;
    return new Cesium.Color(0.0, 1.0, t, 0.85);
  } else {
    const t = (ratio - 0.8) / 0.2;
    return new Cesium.Color(0.0, 1.0 - t * 0.5, 1.0, 0.85);
  }
}

export default function CesiumViewerComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [depthPoints, setDepthPoints] = useState<DepthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("초기화 중...");
  const [clickCoord, setClickCoord] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // Viewer 생성
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
    });

    viewerRef.current = viewer;

    // OSM 3D Buildings (주변 아파트 등 — Ion 기본)
    Cesium.Cesium3DTileset.fromIonAssetId(96188).then((tileset) => {
      if (!viewer.isDestroyed()) viewer.scene.primitives.add(tileset);
    });

    // 북항 주변 건물 3D (OSM에서 추출 + 높이 부여)
    loadBuildings3D(viewer);

    // 클릭 시 좌표 표시
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) return;
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);
      setClickCoord({ lat, lon });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 항만시설 3D 모델 배치
    loadPortModels(viewer);

    // 인천북항 카메라 (37.49689, 126.62209 중심)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(126.62209, 37.49689, 2000),
      orientation: {
        heading: Cesium.Math.toRadians(-20),
        pitch: Cesium.Math.toRadians(-30),
        roll: 0,
      },
      duration: 2,
    });

    // 수심 데이터 로딩
    loadBathymetry(viewer);

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // 북항 주변 OSM 건물 3D 렌더링
  async function loadBuildings3D(viewer: Cesium.Viewer) {
    try {
      const res = await fetch("/api/buildings");
      const geojson = await res.json();
      if (viewer.isDestroyed()) return;

      const BUILDING_COLORS: Record<string, Cesium.Color> = {
        industrial: Cesium.Color.fromCssColorString("#8899AA").withAlpha(0.85),
        storage_tank: Cesium.Color.fromCssColorString("#AA8866").withAlpha(0.85),
        warehouse: Cesium.Color.fromCssColorString("#99AA88").withAlpha(0.85),
        apartments: Cesium.Color.fromCssColorString("#BBAA99").withAlpha(0.85),
        retail: Cesium.Color.fromCssColorString("#AABB99").withAlpha(0.85),
        train_station: Cesium.Color.fromCssColorString("#9999BB").withAlpha(0.85),
        hotel: Cesium.Color.fromCssColorString("#BB99AA").withAlpha(0.85),
        school: Cesium.Color.fromCssColorString("#99AABB").withAlpha(0.85),
      };
      const defaultColor = Cesium.Color.fromCssColorString("#AAAAAA").withAlpha(0.8);

      for (const feature of geojson.features) {
        const coords = feature.geometry.coordinates[0];
        const height = feature.properties.height || 8;
        const buildingType = feature.properties.building || "yes";
        const name = feature.properties.name || buildingType;

        // 좌표 배열 → Cesium 형식 (lon, lat, lon, lat, ...)
        const positions: number[] = [];
        for (const [lon, lat] of coords) {
          positions.push(lon, lat);
        }

        const color = BUILDING_COLORS[buildingType] || defaultColor;

        viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
            height: 0,
            extrudedHeight: height,
            material: color,
            outline: true,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.3),
            outlineWidth: 1,
          },
          name: name,
          description: `
            <table>
              <tr><td><b>유형</b></td><td>${buildingType}</td></tr>
              <tr><td><b>높이</b></td><td>${height}m</td></tr>
            </table>
          `,
        });
      }

      console.log(`북항 건물 ${geojson.features.length}개 렌더링 완료`);
    } catch (e) {
      console.error("건물 로드 실패:", e);
    }
  }

  // 항만시설 3D 모델 배치
  function loadPortModels(viewer: Cesium.Viewer) {
    const hpr0 = Cesium.HeadingPitchRoll.fromDegrees(0, 0, 0);
    const hpr90 = Cesium.HeadingPitchRoll.fromDegrees(90, 0, 0);

    // 갠트리 크레인 — 부두 안벽 따라 배치 (5기)
    // 북항 부두 (37.497, 126.622 중심)
    const cranePositions = [
      { lon: 126.6180, lat: 37.4950, heading: 90 },
      { lon: 126.6180, lat: 37.4970, heading: 90 },
      { lon: 126.6180, lat: 37.4990, heading: 90 },
      { lon: 126.6180, lat: 37.5010, heading: 90 },
      { lon: 126.6180, lat: 37.5030, heading: 90 },
    ];
    for (const c of cranePositions) {
      const pos = Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 0);
      const hpr = Cesium.HeadingPitchRoll.fromDegrees(c.heading, 0, 0);
      viewer.entities.add({
        position: pos,
        orientation: Cesium.Transforms.headingPitchRollQuaternion(pos, hpr) as any,
        model: {
          uri: "/models/crane.glb",
          scale: 1.0,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        name: "갠트리 크레인",
      });
    }

    // 컨테이너 야적장 — 부두 뒤쪽
    const containerPositions = [
      { lon: 126.6210, lat: 37.4950, heading: 0 },
      { lon: 126.6210, lat: 37.4970, heading: 0 },
      { lon: 126.6210, lat: 37.4990, heading: 0 },
      { lon: 126.6230, lat: 37.4950, heading: 0 },
      { lon: 126.6230, lat: 37.4970, heading: 0 },
      { lon: 126.6230, lat: 37.4990, heading: 0 },
      { lon: 126.6210, lat: 37.5010, heading: 0 },
      { lon: 126.6230, lat: 37.5010, heading: 0 },
    ];
    for (const c of containerPositions) {
      const pos = Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 0);
      const hpr = Cesium.HeadingPitchRoll.fromDegrees(c.heading, 0, 0);
      viewer.entities.add({
        position: pos,
        orientation: Cesium.Transforms.headingPitchRollQuaternion(pos, hpr) as any,
        model: {
          uri: "/models/container-stack.glb",
          scale: 1.0,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        name: "컨테이너 야적장",
      });
    }

    // 창고/터미널 건물
    const warehousePositions = [
      { lon: 126.6250, lat: 37.4960, heading: 0 },
      { lon: 126.6250, lat: 37.5000, heading: 0 },
    ];
    for (const w of warehousePositions) {
      const pos = Cesium.Cartesian3.fromDegrees(w.lon, w.lat, 0);
      const hpr = Cesium.HeadingPitchRoll.fromDegrees(w.heading, 0, 0);
      viewer.entities.add({
        position: pos,
        orientation: Cesium.Transforms.headingPitchRollQuaternion(pos, hpr) as any,
        model: {
          uri: "/models/warehouse.glb",
          scale: 1.0,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        name: "터미널 창고",
      });
    }

    // 컨테이너 선박 — 부두 안벽에 접안
    const shipPositions = [
      { lon: 126.6155, lat: 37.4965, heading: 0 },
      { lon: 126.6155, lat: 37.5005, heading: 0 },
    ];
    for (const s of shipPositions) {
      const pos = Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 0);
      const hpr = Cesium.HeadingPitchRoll.fromDegrees(s.heading, 0, 0);
      viewer.entities.add({
        position: pos,
        orientation: Cesium.Transforms.headingPitchRollQuaternion(pos, hpr) as any,
        model: {
          uri: "/models/container-ship.glb",
          scale: 1.0,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        },
        name: "컨테이너 선박",
      });
    }
  }

  async function loadBathymetry(viewer: Cesium.Viewer) {
    setStatus("수심 데이터 로딩 중...");
    try {
      const res = await fetch("/api/bathymetry");
      const data = await res.json();
      const points: DepthPoint[] = data.points;
      setDepthPoints(points);

      setStatus(`수심 포인트 ${points.length}개 렌더링 중...`);

      // 수심 데이터는 로드만 해두고 렌더링은 나중에
      const waterPoints = points.filter((p) => isInWater(p.lon, p.lat));
      setDepthPoints(waterPoints);

      setStatus("완료");
      setLoading(false);
    } catch (error) {
      setStatus("데이터 로딩 실패");
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* 상단 타이틀 */}
      <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg">
        <h1 className="text-lg font-bold">인천항(북항) 3D 해양관제</h1>
        <p className="text-xs text-gray-400">
          {loading ? status : `수심 포인트 ${depthPoints.length}개 | ${status}`}
        </p>
      </div>

      {/* 수심 범례 */}
      <DepthLegend />

      {/* 조위 패널 */}
      <TidePanel />

      {/* 클릭 좌표 표시 */}
      {clickCoord && (
        <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur px-4 py-2 rounded-lg font-mono text-sm">
          <p className="text-yellow-400">
            {clickCoord.lat.toFixed(5)}, {clickCoord.lon.toFixed(5)}
          </p>
        </div>
      )}
    </div>
  );
}
