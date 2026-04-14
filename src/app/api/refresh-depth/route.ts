import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    const scriptPath = join(process.cwd(), "scripts/refresh-depth.py");
    const env = {
      ...process.env,
      DATA_GO_KR_KEY2: process.env.DATA_GO_KR_KEY2 || "",
    };

    const { stdout, stderr } = await execFileAsync("python3", [scriptPath], {
      env,
      timeout: 300000, // 5분
      maxBuffer: 10 * 1024 * 1024,
    });

    // 마지막 줄의 JSON 파싱
    const lines = stdout.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const result = JSON.parse(lastLine);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
