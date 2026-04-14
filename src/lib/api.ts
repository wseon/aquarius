import https from "https";

const BASE_URL = "https://apis.data.go.kr/1192136";

// data.go.kr은 serviceKey에 %2B를 요구하지만 Node fetch()는 URL을 정규화하면서
// %2B→+로 변환합니다. https.get으로 raw URL을 보존합니다.
function getEncodedKey(): string {
  const raw = process.env.DATA_GO_KR_KEY || "";
  return encodeURIComponent(raw);
}

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

export interface DepthPoint {
  lat: number;
  lon: number;
  depth: number;
}

export interface TideRecord {
  stationName: string;
  lat: number;
  lon: number;
  datetime: string;
  measured: number;
  predicted: number;
}

export async function fetchBathymetry(
  ymin: number,
  ymax: number,
  xmin: number,
  xmax: number
): Promise<DepthPoint[]> {
  const allPoints: DepthPoint[] = [];
  let page = 1;
  let totalCount = Infinity;
  const key = getEncodedKey();

  while (allPoints.length < totalCount) {
    const url = `${BASE_URL}/waterDepth/GetWaterDepthApiService?serviceKey=${key}&type=json&ymin=${ymin}&ymax=${ymax}&xmin=${xmin}&xmax=${xmax}&pageNo=${page}&numOfRows=300`;

    const text = await httpsGet(url);

    if (text.startsWith("Unauthorized")) {
      throw new Error("API 인증 실패");
    }

    const data = JSON.parse(text);
    if (data.header?.resultCode !== "00") break;

    totalCount = data.body.totalCount;
    const items = data.body.items?.item || [];
    for (const item of items) {
      allPoints.push({
        lat: item.lat,
        lon: item.lot,
        depth: item.dpwt,
      });
    }
    page++;
  }

  return allPoints;
}

export async function fetchTide(
  obsCode: string,
  date: string
): Promise<TideRecord[]> {
  const key = getEncodedKey();
  const url = `${BASE_URL}/surveyTideLevel/GetSurveyTideLevelApiService?serviceKey=${key}&type=json&obsCode=${obsCode}&reqDate=${date}&min=60&pageNo=1&numOfRows=300`;

  const text = await httpsGet(url);
  if (text.startsWith("Unauthorized")) return [];

  const data = JSON.parse(text);
  if (data.header?.resultCode !== "00") return [];

  return (data.body.items?.item || []).map((item: any) => ({
    stationName: item.obsvtrNm,
    lat: item.lat,
    lon: item.lot,
    datetime: item.obsrvnDt,
    measured: item.bscTdlvHgt,
    predicted: item.tdlvHgt,
  }));
}
