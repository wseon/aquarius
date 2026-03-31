"use client";

import dynamic from "next/dynamic";
import LayerPanel from "@/components/ui/LayerPanel";
import InfoPanel from "@/components/ui/InfoPanel";
import TimeSlider from "@/components/ui/TimeSlider";
import Header from "@/components/ui/Header";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#080c14]">
      <p className="text-sm text-gray-600">3D 해양관제 로딩 중...</p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="h-screen w-screen relative bg-[#080c14] overflow-hidden">
      <MapView />
      <Header />
      <LayerPanel />
      <InfoPanel />
      <TimeSlider />
    </main>
  );
}
