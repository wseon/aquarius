import { NextResponse } from "next/server";
import { fetchBathymetry } from "@/lib/api";
import { readFile } from "fs/promises";
import { join } from "path";

const BOUNDS = {
  ymin: 37.44,
  ymax: 37.48,
  xmin: 126.58,
  xmax: 126.64,
};

export async function GET() {
  // 1) 먼저 API 호출 시도
  try {
    const points = await fetchBathymetry(
      BOUNDS.ymin,
      BOUNDS.ymax,
      BOUNDS.xmin,
      BOUNDS.xmax
    );
    if (points.length > 0) {
      return NextResponse.json({ points, count: points.length, source: "api" });
    }
  } catch {
    // API 실패 시 캐시로 폴백
  }

  // 2) 로컬 캐시 사용
  try {
    const cachePath = join(process.cwd(), "src/data/bathymetry-cache.json");
    const raw = await readFile(cachePath, "utf-8");
    const cached = JSON.parse(raw);
    return NextResponse.json({ ...cached, source: "cache" });
  } catch {
    return NextResponse.json(
      { error: "수심 데이터를 가져올 수 없습니다" },
      { status: 503 }
    );
  }
}
