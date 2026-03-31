"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
const Header = dynamic(() => import("@/components/ui/Header"), { ssr: false });
const LayerPanel = dynamic(() => import("@/components/ui/LayerPanel"), { ssr: false });
const InfoPanel = dynamic(() => import("@/components/ui/InfoPanel"), { ssr: false });
const TimeSlider = dynamic(() => import("@/components/ui/TimeSlider"), { ssr: false });

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
