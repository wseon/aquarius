import { NextRequest, NextResponse } from "next/server";
import { fetchTide } from "@/lib/api-cache";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") || getTodayString();
  const obsCode = searchParams.get("obsCode") || "DT_0001";

  // 1) 실시간 API 시도
  try {
    const data = await fetchTide(obsCode, date);
    const items = data.body?.items?.item || [];
    const records = items.map((item: any) => ({
      stationName: item.obsvtrNm,
      lat: item.lat,
      lon: item.lot,
      datetime: item.obsrvnDt,
      measured: item.bscTdlvHgt,
      predicted: item.tdlvHgt,
    }));
    return NextResponse.json({ records, count: records.length, source: "api" });
  } catch {
    // API 실패
  }

  // 2) 캐시 폴백
  try {
    const cachePath = join(process.cwd(), "src/data/tide-cache.json");
    const raw = await readFile(cachePath, "utf-8");
    const cached = JSON.parse(raw);
    return NextResponse.json({ ...cached, source: "cache" });
  } catch {
    return NextResponse.json({ error: "조위 데이터 없음" }, { status: 503 });
  }
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
