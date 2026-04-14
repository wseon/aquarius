import { NextRequest, NextResponse } from "next/server";
import { fetchTideBED } from "@/lib/api-cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "37.45");
  const lon = parseFloat(searchParams.get("lon") || "126.59");
  const date = searchParams.get("date") || getTodayString();

  try {
    const data = await fetchTideBED(lat, lon, date);
    const items = data.body?.items?.item || [];
    const records = items.map((item: any) => ({
      datetime: item.obsrvnDt,
      predictedHeight: item.obsrvnHgt,
      selectedHeight: parseFloat(item.slctdHgt),
      m2Amp: item.m2TdlvAmp,
      m2Lag: item.m2TdlvTlag,
      s2Amp: item.s2TdlvAmp,
      s2Lag: item.s2TdlvTlag,
      k1Amp: item.k1TdlvAmp,
      k1Lag: item.k1TdlvTlag,
      o1Amp: item.o1TdlvAmp,
      o1Lag: item.o1TdlvTlag,
      msl: item.msl,
      jogo: parseFloat(item.jogo),
    }));
    return NextResponse.json({ records, count: records.length, source: "api" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "TideBED 데이터 없음" }, { status: 503 });
  }
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
