"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const RoiSelector = dynamic(() => import("@/components/roi/RoiSelector"), { ssr: false });

export default function RoiPage() {
  const [roi, setRoi] = useState<{ north: number; south: number; west: number; east: number } | null>(null);

  return (
    <main style={{ width: "100vw", height: "100vh", background: "#080c14" }}>
      <RoiSelector
        onRoiSelected={(r) => {
          setRoi(r);
          console.log("ROI Selected:", JSON.stringify(r, null, 2));
        }}
        onMasksChanged={() => {}}
        initialCenter={{ lat: 35.075, lon: 128.81, zoom: 25000 }}
      />
      {roi && (
        <div style={{
          position: "fixed", top: 16, right: 16, background: "rgba(10,15,26,0.95)",
          border: "1px solid rgba(6,182,212,0.5)", borderRadius: 8, padding: 16, zIndex: 20,
          color: "white", fontFamily: "monospace", fontSize: 13,
        }}>
          <h3 style={{ margin: "0 0 8px", color: "#67e8f9" }}>선택된 ROI (부산신항)</h3>
          <p>North: {roi.north.toFixed(5)}</p>
          <p>South: {roi.south.toFixed(5)}</p>
          <p>West: {roi.west.toFixed(5)}</p>
          <p>East: {roi.east.toFixed(5)}</p>
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(roi, null, 2))}
            style={{
              marginTop: 8, padding: "6px 12px", background: "#06b6d4", color: "white",
              border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, width: "100%",
            }}
          >
            좌표 복사
          </button>
        </div>
      )}
    </main>
  );
}
