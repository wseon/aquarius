"use client";

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN!;
(window as any).CESIUM_BASE_URL = "/cesium";

interface Props {
  onRoiSelected: (roi: { north: number; south: number; west: number; east: number }) => void;
  onMasksChanged: (masks: any[]) => void;
  initialCenter?: { lat: number; lon: number; zoom: number };
}

export default function RoiSelector({ onRoiSelected, initialCenter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [mode, setMode] = useState<"roi" | "idle">("idle");
  const modeRef = useRef(mode);
  const [roi, setRoi] = useState<{ north: number; south: number; west: number; east: number } | null>(null);
  const [coordDisplay, setCoordDisplay] = useState("");
  const roiEntityRef = useRef<Cesium.Entity | null>(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      geocoder: true,
      homeButton: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      sceneModePicker: false,
      infoBox: false,
      selectionIndicator: false,
    });
    viewerRef.current = viewer;

    const center = initialCenter || { lat: 35.075, lon: 128.81, zoom: 25000 };
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, center.zoom),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-60), roll: 0 },
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    let roiDragStart: { lat: number; lon: number } | null = null;

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

    handler.setInputAction((move: { endPosition: Cesium.Cartesian2 }) => {
      const coord = pickLatLon(move.endPosition);
      if (coord) setCoordDisplay(`${coord.lat.toFixed(5)}, ${coord.lon.toFixed(5)}`);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      if (viewer.isDestroyed()) return;
      const coord = pickLatLon(click.position);
      if (!coord) return;

      if (modeRef.current === "roi") {
        if (!roiDragStart) {
          roiDragStart = coord;
        } else {
          const n = Math.max(roiDragStart.lat, coord.lat);
          const s = Math.min(roiDragStart.lat, coord.lat);
          const e = Math.max(roiDragStart.lon, coord.lon);
          const w = Math.min(roiDragStart.lon, coord.lon);
          const newRoi = { north: n, south: s, east: e, west: w };
          setRoi(newRoi);
          onRoiSelected(newRoi);

          if (roiEntityRef.current) viewer.entities.remove(roiEntityRef.current);
          roiEntityRef.current = viewer.entities.add({
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray([w, s, e, s, e, n, w, n]),
              height: 0,
              material: Cesium.Color.CYAN.withAlpha(0.15),
              outline: true,
              outlineColor: Cesium.Color.CYAN,
            },
          });
          roiDragStart = null;
          setMode("idle");
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(10,15,26,0.95)", border: "1px solid rgba(55,65,81,0.5)", borderRadius: 8, padding: 12, zIndex: 10, minWidth: 180 }}>
        <h2 style={{ fontSize: 14, fontWeight: "bold", color: "white", margin: "0 0 8px 0" }}>ROI 설정</h2>
        <button
          onClick={() => setMode("roi")}
          style={{ display: "block", width: "100%", padding: "6px 12px", fontSize: 12, border: mode === "roi" ? "1px solid #06b6d4" : "1px solid #374151", background: mode === "roi" ? "rgba(6,182,212,0.2)" : "#1f2937", color: mode === "roi" ? "#67e8f9" : "#9ca3af", borderRadius: 4, cursor: "pointer" }}
        >
          {mode === "roi" ? "두 점을 클릭하세요..." : "ROI 영역 선택"}
        </button>

        {roi && (
          <div style={{ fontSize: 10, color: "#6b7280", borderTop: "1px solid #1f2937", paddingTop: 8, marginTop: 8 }}>
            <p>NW: {roi.north.toFixed(5)}, {roi.west.toFixed(5)}</p>
            <p>SE: {roi.south.toFixed(5)}, {roi.east.toFixed(5)}</p>
          </div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(10,15,26,0.9)", padding: "4px 12px", borderRadius: 4, fontSize: 12, color: "#facc15", fontFamily: "monospace", zIndex: 10 }}>
        {coordDisplay}
      </div>
    </div>
  );
}
