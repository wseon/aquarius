import { NextRequest, NextResponse } from "next/server";
import { fetchTide } from "@/lib/api";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") || getTodayString();
  const obsCode = searchParams.get("obsCode") || "DT_0001";

  // 1) API 호출 시도
  try {
    const records = await fetchTide(obsCode, date);
    if (records.length > 0) {
      return NextResponse.json({
        records,
        count: records.length,
        source: "api",
      });
    }
  } catch {
    // API 실패 시 캐시로 폴백
  }

  // 2) 로컬 캐시 사용
  try {
    const cachePath = join(process.cwd(), "src/data/tide-cache.json");
    const raw = await readFile(cachePath, "utf-8");
    const cached = JSON.parse(raw);
    return NextResponse.json({ ...cached, source: "cache" });
  } catch {
    return NextResponse.json(
      { error: "조위 데이터를 가져올 수 없습니다" },
      { status: 503 }
    );
  }
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
