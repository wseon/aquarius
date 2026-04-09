import { NextResponse } from "next/server";
import { fetchBathymetry } from "@/lib/api-cache";
import { readFile } from "fs/promises";
import { join } from "path";

const BOUNDS = {
  ymin: 37.479,
  ymax: 37.513,
  xmin: 126.583,
  xmax: 126.627,
};

export async function GET() {
  // 1) 실시간 API 시도
  try {
    const data = await fetchBathymetry(BOUNDS.ymin, BOUNDS.ymax, BOUNDS.xmin, BOUNDS.xmax);
    const items = data.body?.items?.item || [];
    const points = items.map((item: any) => ({
      lat: item.lat,
      lon: item.lot,
      depth: item.dpwt,
    }));
    if (points.length > 0) {
      return NextResponse.json({ points, count: points.length, source: "api" });
    }
  } catch {
    // API 실패
  }

  // 2) 캐시 폴백
  try {
    const cachePath = join(process.cwd(), "src/data/bathymetry-cache.json");
    const raw = await readFile(cachePath, "utf-8");
    const cached = JSON.parse(raw);
    return NextResponse.json({ ...cached, source: "cache" });
  } catch {
    return NextResponse.json({ error: "수심 데이터 없음" }, { status: 503 });
  }
}
