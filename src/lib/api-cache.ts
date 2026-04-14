import https from "https";

const API_KEY = process.env.DATA_GO_KR_KEY2 || "";
const BASE_URL = "https://apis.data.go.kr/1192136";
const MIN_INTERVAL_MS = 60000; // 1분

// 캐시 저장소
const cache: Record<string, { data: any; timestamp: number }> = {};

// 마지막 요청 시간
let lastRequestTime = 0;

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function fetchWithRateLimit(cacheKey: string, url: string, ttlMs: number = 300000): Promise<any> {
  // 캐시 확인 (TTL 내면 캐시 반환)
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data;
  }

  // 요청 간격 확인 (1분)
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    // 아직 1분 안 됨 — 캐시 있으면 만료되어도 반환
    if (cached) return cached.data;
    // 캐시 없으면 대기
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }

  lastRequestTime = Date.now();
  console.log(`[API] 요청: ${cacheKey}`);

  const text = await httpsGet(url);
  if (text.startsWith("Unauthorized") || text.startsWith("<")) {
    console.error(`[API] 실패: ${cacheKey} → ${text.substring(0, 50)}`);
    if (cached) return cached.data;
    throw new Error("API 인증 실패");
  }

  const data = JSON.parse(text);
  if (data.header?.resultCode !== "00") {
    console.error(`[API] 에러: ${cacheKey} → ${data.header?.resultMsg}`);
    if (cached) return cached.data;
    throw new Error(data.header?.resultMsg || "API 에러");
  }

  cache[cacheKey] = { data, timestamp: Date.now() };
  return data;
}

// 수심 조회
export async function fetchBathymetry(ymin: number, ymax: number, xmin: number, xmax: number) {
  const key = encodeURIComponent(API_KEY);
  const url = `${BASE_URL}/waterDepth/GetWaterDepthApiService?serviceKey=${key}&type=json&ymin=${ymin}&ymax=${ymax}&xmin=${xmin}&xmax=${xmax}&pageNo=1&numOfRows=500`;
  const cacheKey = `depth_${ymin}_${ymax}_${xmin}_${xmax}`;
  return fetchWithRateLimit(cacheKey, url, 3600000); // 1시간 캐시 (수심은 안 변함)
}

// 조위 조회
export async function fetchTide(obsCode: string, date: string) {
  const key = encodeURIComponent(API_KEY);
  const url = `${BASE_URL}/surveyTideLevel/GetSurveyTideLevelApiService?serviceKey=${key}&type=json&obsCode=${obsCode}&reqDate=${date}&min=60&pageNo=1&numOfRows=24`;
  const cacheKey = `tide_${obsCode}_${date}`;
  return fetchWithRateLimit(cacheKey, url, 300000); // 5분 캐시
}

// TideBED 조회
export async function fetchTideBED(lat: number, lon: number, date: string) {
  const key = encodeURIComponent(API_KEY);
  const url = `${BASE_URL}/tidebed/GetTidebedApiService?serviceKey=${key}&type=json&lat=${lat}&lot=${lon}&reqDate=${date}&min=60&pageNo=1&numOfRows=24`;
  const cacheKey = `tidebed_${lat}_${lon}_${date}`;
  return fetchWithRateLimit(cacheKey, url, 300000); // 5분 캐시
}
