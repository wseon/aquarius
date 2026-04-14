#!/usr/bin/env python3
"""수심 데이터 갱신 스크립트"""
import json
import os
import sys
import math
import time
import bisect
import urllib.request
import urllib.parse

def main():
    api_key = os.environ.get("DATA_GO_KR_KEY2", "")
    if not api_key:
        print(json.dumps({"success": False, "error": "API 키 없음"}))
        return

    # terrain-watermap 로드
    wm_path = os.path.join(os.getcwd(), "src/data/terrain-watermap.json")
    with open(wm_path) as f:
        data = json.load(f)

    lats = data["lats"]
    lons = data["lons"]
    waterMap = data["waterMap"]

    latMin, latMax = min(lats), max(lats)
    lonMin, lonMax = min(lons), max(lons)

    # 0.01도 단위 분할 호출
    all_items = []
    api_calls = 0

    iLatMin = int(math.floor(latMin * 100))
    iLatMax = int(math.ceil(latMax * 100))
    iLonMin = int(math.floor(lonMin * 100))
    iLonMax = int(math.ceil(lonMax * 100))

    for iLat in range(iLatMin, iLatMax):
        for iLon in range(iLonMin, iLonMax):
            ymin = f"{iLat / 100:.2f}"
            ymax = f"{(iLat + 1) / 100:.2f}"
            xmin = f"{iLon / 100:.2f}"
            xmax = f"{(iLon + 1) / 100:.2f}"

            params = urllib.parse.urlencode({
                "serviceKey": api_key,
                "type": "json",
                "ymin": ymin, "ymax": ymax,
                "xmin": xmin, "xmax": xmax,
                "pageNo": 1, "numOfRows": 500,
            })
            url = f"https://apis.data.go.kr/1192136/waterDepth/GetWaterDepthApiService?{params}"

            for retry in range(2):
                try:
                    raw = urllib.request.urlopen(url, timeout=10).read().decode()
                    resp = json.loads(raw)
                    rc = resp.get("header", {}).get("resultCode")
                    if rc == "00":
                        items = resp["body"]["items"]["item"]
                        if isinstance(items, dict):
                            items = [items]
                        all_items.extend(items)
                        break
                    elif rc == "03":  # NO_DATA
                        break
                    else:
                        time.sleep(2)
                except:
                    time.sleep(2)

            api_calls += 1
            time.sleep(1)

    if not all_items:
        # 폴백: 캐시 파일 사용
        cache_path = os.path.join(os.getcwd(), "src/data/bathymetry-cache.json")
        if os.path.exists(cache_path):
            with open(cache_path) as cf:
                cache = json.load(cf)
            cache_points = [p for p in cache.get("points", []) if p.get("isWater")]
            if cache_points:
                for p in cache_points:
                    all_items.append({"lat": p["lat"], "lot": p["lon"], "dpwt": p["depth"]})

        if not all_items:
            print(json.dumps({"success": False, "error": "수심 데이터 없음 (API 차단, 캐시도 없음)", "apiCalls": api_calls}))
            return

    # depthMap 갱신
    depthMap = {}
    latStep = lats[1] - lats[0]
    lonStep = lons[1] - lons[0]

    for item in all_items:
        pLat, pLon, depth = item["lat"], item["lot"], item["dpwt"]
        li = bisect.bisect_left(lats, pLat)
        lj = bisect.bisect_left(lons, pLon)
        for di in range(-1, 2):
            for dj in range(-1, 2):
                i, j = li + di, lj + dj
                if 0 <= i < len(lats) and 0 <= j < len(lons):
                    key = f"{lats[i]},{lons[j]}"
                    if waterMap.get(key):
                        depthMap[key] = round(depth, 1)

    # IDW 보간
    measured = sorted(
        [(float(k.split(",")[0]), float(k.split(",")[1]), v) for k, v in depthMap.items()],
        key=lambda x: x[0]
    )
    mLats = [m[0] for m in measured]

    empty = [k for k, v in waterMap.items() if v and k not in depthMap]
    for key in empty:
        lat, lon = [float(x) for x in key.split(",")]
        si = bisect.bisect_left(mLats, lat)
        cands = []
        for di in range(-25, 26):
            mi = si + di
            if 0 <= mi < len(measured):
                m = measured[mi]
                dist = math.sqrt((lat - m[0])**2 + (lon - m[1])**2)
                cands.append((dist, m[2]))
        cands.sort()
        top3 = cands[:3]
        if not top3:
            depthMap[key] = 20.0
            continue
        tw, td = 0, 0
        for d, dep in top3:
            if d < 0.00001:
                td, tw = dep, 1
                break
            w = 1 / (d ** 2)
            tw += w
            td += w * dep
        depthMap[key] = round(td / tw, 1)

    # 3회 스무딩
    dm = depthMap
    for _ in range(3):
        new_dm = {}
        for key, depth in dm.items():
            lat, lon = [float(x) for x in key.split(",")]
            neighbors = [depth]
            for di in range(-1, 2):
                for dj in range(-1, 2):
                    if di == 0 and dj == 0:
                        continue
                    nk = f"{round(lat + di * latStep, 6)},{round(lon + dj * lonStep, 6)}"
                    if nk in dm:
                        neighbors.append(dm[nk])
            new_dm[key] = round(sum(neighbors) / len(neighbors), 1)
        dm = new_dm

    # 저장
    data["depthMap"] = dm
    with open(wm_path, "w") as f:
        json.dump(data, f)

    print(json.dumps({
        "success": True,
        "apiCalls": api_calls,
        "rawPoints": len(all_items),
        "matchedPoints": len(depthMap),
        "totalDepthMap": len(dm),
    }))

if __name__ == "__main__":
    main()
