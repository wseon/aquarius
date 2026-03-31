import { create } from "zustand";

export interface LayerState {
  // 레이어 표시 여부
  bathymetry: boolean;
  currentFlow: boolean;
  channels: boolean;
  dangerZones: boolean;
  facilities: boolean;
  vessels: boolean;
  waterSurface: boolean;
  waterTemp: boolean;
  salinity: boolean;
  pollution: boolean;

  // 수심 필터
  depthFilter: "all" | "surface" | "mid" | "bottom";

  // 시간 슬라이더 (0~23시)
  timeHour: number;

  // 베이스맵
  basemap: "simple" | "satellite";

  // 액션
  toggleLayer: (layer: string) => void;
  setDepthFilter: (filter: "all" | "surface" | "mid" | "bottom") => void;
  setTimeHour: (hour: number) => void;
  setBasemap: (basemap: "simple" | "satellite") => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  bathymetry: true,
  currentFlow: true,
  channels: true,
  dangerZones: true,
  facilities: true,
  vessels: true,
  waterSurface: true,
  waterTemp: false,
  salinity: false,
  pollution: false,

  depthFilter: "all",
  timeHour: 12,
  basemap: "simple",

  toggleLayer: (layer) =>
    set((state) => ({ ...state, [layer]: !state[layer as keyof LayerState] })),
  setDepthFilter: (filter) => set({ depthFilter: filter }),
  setTimeHour: (hour) => set({ timeHour: hour }),
  setBasemap: (basemap) => set({ basemap }),
}));
