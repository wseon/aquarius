import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { fetchBathymetry } from "@/lib/api-cache";

// 실시간 수심으로 갱신된 depthMap 캐시
let enhancedCache: any = null;
let enhancedCacheTime = 0;
const CACHE_TTL = 600000; // 10분

async function getEnhancedData() {
  const now = Date.now();
  if (enhancedCache && now - enhancedCacheTime < CACHE_TTL) {
    return enhancedCache;
  }

  // 기본 데이터 로드
  const filePath = join(process.cwd(), "src/data/terrain-watermap.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  // 실시간 수심 데이터 가져오기
  try {
    const bathData = await fetchBathymetry(37.479, 37.513, 126.583, 126.627);
    const items = bathData.body?.items?.item || [];

    if (items.length > 0) {
      console.log(`[terrain] 실시간 수심 ${items.length}개 포인트 매칭 시작`);

      const depthMap = data.depthMap || {};
      const lats = data.lats as number[];
      const lons = data.lons as number[];
      let matched = 0;

      // 각 API 수심 포인트를 가장 가까운 watermap 격자에 매칭
      for (const item of items) {
        const apiLat = item.lat;
        const apiLon = item.lot;
        const depth = item.dpwt;

        // 가장 가까운 격자점 찾기
        let bestKey = "";
        let bestDist = Infinity;

        // 근처 격자점만 검색 (성능)
        const latStep = lats[1] - lats[0];
        const lonStep = lons[1] - lons[0];
        const latIdx = Math.round((apiLat - lats[0]) / latStep);
        const lonIdx = Math.round((apiLon - lons[0]) / lonStep);

        for (let di = -3; di <= 3; di++) {
          for (let dj = -3; dj <= 3; dj++) {
            const li = latIdx + di;
            const lj = lonIdx + dj;
            if (li < 0 || li >= lats.length || lj < 0 || lj >= lons.length) continue;

            const key = `${lats[li]},${lons[lj]}`;
            if (data.waterMap[key] !== true) continue;

            const dist = Math.abs(lats[li] - apiLat) + Math.abs(lons[lj] - apiLon);
            if (dist < bestDist) {
              bestDist = dist;
              bestKey = key;
            }
          }
        }

        if (bestKey && bestDist < 0.002) {
          depthMap[bestKey] = depth;
          matched++;

          // 주변 격자에도 보간 적용
          const [bLat, bLon] = bestKey.split(",").map(Number);
          for (let di = -2; di <= 2; di++) {
            for (let dj = -2; dj <= 2; dj++) {
              if (di === 0 && dj === 0) continue;
              const nKey = `${(bLat + di * latStep).toFixed(6)},${(bLon + dj * lonStep).toFixed(6)}`;
              if (data.waterMap[nKey] === true && !depthMap[nKey]) {
                const dist = Math.sqrt(di * di + dj * dj);
                // 거리 가중 보간
                depthMap[nKey] = Math.round((depth + (depthMap[nKey] || depth)) / 2 * 10) / 10;
              }
            }
          }
        }
      }

      data.depthMap = depthMap;
      console.log(`[terrain] 실시간 수심 ${matched}개 매칭 완료`);
    }
  } catch (e) {
    console.warn("[terrain] 실시간 수심 가져오기 실패, 캐시 데이터 사용:", e);
  }

  enhancedCache = data;
  enhancedCacheTime = now;
  return data;
}

export async function GET() {
  try {
    const data = await getEnhancedData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "지형 데이터 로드 실패" }, { status: 500 });
  }
}
