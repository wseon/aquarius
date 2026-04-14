import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "src/data/building-colors.json");
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "건물 색상 로드 실패" }, { status: 500 });
  }
}
