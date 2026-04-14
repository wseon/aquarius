"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Environment, Grid } from "@react-three/drei";
import { useEffect, useState } from "react";
import * as THREE from "three";
import PortGround from "./PortGround";
import WaterPlane from "./WaterPlane";
import Crane from "./Crane";
import ContainerStack from "./ContainerStack";
import StorageTank from "./StorageTank";
import Warehouse from "./Warehouse";
import Ship from "./Ship";
import Pier from "./Pier";
import TidePanel from "@/components/dashboard/TidePanel";

export default function PortScene() {
  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{
          position: [200, 150, 200],
          fov: 35,
          near: 0.1,
          far: 2000,
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        style={{ background: "#0a0e17" }}
      >
        <SceneContent />
      </Canvas>

      {/* UI 오버레이 */}
      <div className="absolute top-4 left-4 bg-[#0d1320]/90 backdrop-blur border border-gray-700/50 px-4 py-3 rounded-lg">
        <h1 className="text-base font-bold text-white">인천항(북항) 3D 해양관제</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">SCADA Monitoring System</p>
      </div>

      <TidePanel />
    </div>
  );
}

function SceneContent() {
  return (
    <>
      {/* 조명 */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[100, 200, 100]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={500}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      <directionalLight position={[-50, 100, -50]} intensity={0.3} />
      <fog attach="fog" args={["#0a0e17", 300, 600]} />

      {/* 컨트롤 */}
      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.2}
        minDistance={30}
        maxDistance={500}
        target={[0, 0, 0]}
      />

      {/* 바닥 그리드 */}
      <Grid
        position={[0, -0.01, 0]}
        args={[400, 400]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#1a2038"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#243050"
        fadeDistance={400}
        infiniteGrid
      />

      {/* 지면 */}
      <PortGround />

      {/* 해수면 */}
      <WaterPlane />

      {/* 부두 (안벽) */}
      <Pier position={[-40, 0, -80]} length={200} />
      <Pier position={[60, 0, -80]} length={160} />

      {/* 갠트리 크레인 — 안벽 위 */}
      <Crane position={[-40, 0, -60]} label="Crane #1" status="운행중" />
      <Crane position={[-40, 0, -20]} label="Crane #2" status="운행중" />
      <Crane position={[-40, 0, 20]} label="Crane #3" status="대기" />
      <Crane position={[60, 0, -50]} label="Crane #4" status="운행중" />
      <Crane position={[60, 0, -10]} label="Crane #5" status="정비중" />

      {/* 컨테이너 야적장 */}
      <ContainerStack position={[-20, 0, -55]} rows={4} cols={6} layers={3} color="#2563eb" />
      <ContainerStack position={[-20, 0, -25]} rows={4} cols={6} layers={4} color="#0891b2" />
      <ContainerStack position={[-20, 0, 5]} rows={4} cols={6} layers={2} color="#059669" />
      <ContainerStack position={[80, 0, -45]} rows={3} cols={5} layers={3} color="#d97706" />
      <ContainerStack position={[80, 0, -15]} rows={3} cols={5} layers={2} color="#2563eb" />

      {/* 저장탱크 */}
      <StorageTank position={[30, 0, 50]} radius={8} height={15} label="Tank 01" volume={299} capacity={500} />
      <StorageTank position={[55, 0, 50]} radius={8} height={15} label="Tank 02" volume={182} capacity={500} />
      <StorageTank position={[30, 0, 80]} radius={6} height={12} label="Tank 03" volume={95} capacity={200} />
      <StorageTank position={[55, 0, 80]} radius={6} height={12} label="Tank 04" volume={44} capacity={200} />

      {/* 창고/터미널 */}
      <Warehouse position={[10, 0, 55]} width={30} depth={15} height={12} label="창고 A" />
      <Warehouse position={[90, 0, 30]} width={25} depth={12} height={10} label="창고 B" />

      {/* 선박 */}
      <Ship position={[-55, 0, -40]} length={80} label="EVER GIVEN" status="하역중" />
      <Ship position={[45, 0, -65]} length={60} label="HMM OSLO" status="접안 대기" />
    </>
  );
}
