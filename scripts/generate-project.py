#!/usr/bin/env python3
"""
generate-project.py — 051 부산 신항 (Busan New Port)
3D 항만 모니터링 시스템을 위한 전체 데이터 생성 스크립트

생성 파일:
  src/data/terrain-watermap.json
  src/data/buildings-manual.json
  src/data/building-colors.json
  src/data/current-vectors.json
  src/data/vessels.json
  src/data/tide-cache.json
"""

import json, math, os, sys, time, random, struct, urllib.request, urllib.error, urllib.parse

# ──────────────────────────────────────────────────
#  ROI CONFIG — 051 부산 신항 (Busan New Port)
# ──────────────────────────────────────────────────
ROI_NORTH = 35.09706
ROI_SOUTH = 35.03414
ROI_WEST  = 128.76553
ROI_EAST  = 128.83499

CENTER_LAT = (ROI_NORTH + ROI_SOUTH) / 2   # 35.0656
CENTER_LON = (ROI_EAST  + ROI_WEST)  / 2   # 128.80026

# 해상도 (~6m)
LAT_STEP = 0.00005614
LON_STEP = 0.0000700

PROJECT_NAME = "051_busan_newport"
STATION_NAME = "가덕도"          # 부산 신항 인근 조위 관측소
STATION_LAT  = 35.0233
STATION_LON  = 128.8097

# 조류 기본 방향 (부산 신항: 창조류 ~340°, 낙조류 ~160°)
FLOOD_DIR = 340.0
EBB_DIR   = 160.0

# depth API
DATA_GO_KR_KEY = os.environ.get(
    "DATA_GO_KR_KEY2",
    "79f43e03bc1ded95637a3a4693e1fa0a086f29c489a40f7cbc0b5db6b6409824"
)
DEPTH_API = "https://apis.data.go.kr/1192136/waterDepth/GetWaterDepthApiService"

# 선박 데이터
VESSELS = [
    {
        "mmsi": "440201001", "name": "HMM GDANSK", "callSign": "D5BQ9",
        "type": "컨테이너선", "typeCode": 71,
        "lat": 35.075, "lon": 128.790, "heading": 0, "cog": 358.0,
        "speed": 0, "sog": 0.1, "status": "하역중", "navStatus": 5,
        "length": 366, "width": 51, "draft": 14.5,
        "destination": "BUSAN NEW PORT", "eta": "2026-04-15 08:00", "flag": "PA"
    },
    {
        "mmsi": "440201002", "name": "EVER APEX", "callSign": "BKLA",
        "type": "컨테이너선", "typeCode": 71,
        "lat": 35.070, "lon": 128.795, "heading": 340, "cog": 338.5,
        "speed": 5.2, "sog": 5.2, "status": "입항중", "navStatus": 0,
        "length": 334, "width": 48, "draft": 13.0,
        "destination": "BUSAN NEW PORT", "eta": "2026-04-14 22:00", "flag": "TW"
    },
    {
        "mmsi": "440201003", "name": "KOREA STAR", "callSign": "HLBX",
        "type": "벌크선", "typeCode": 70,
        "lat": 35.062, "lon": 128.810, "heading": 180, "cog": 178.0,
        "speed": 0, "sog": 0.0, "status": "정박중", "navStatus": 1,
        "length": 225, "width": 32, "draft": 11.2,
        "destination": "BUSAN", "eta": "2026-04-16 06:00", "flag": "KR"
    },
    {
        "mmsi": "440201004", "name": "PACIFIC VOYAGER", "callSign": "3FWR8",
        "type": "탱커", "typeCode": 80,
        "lat": 35.055, "lon": 128.785, "heading": 90, "cog": 88.0,
        "speed": 3.1, "sog": 3.1, "status": "이동중", "navStatus": 0,
        "length": 180, "width": 28, "draft": 9.5,
        "destination": "ULSAN", "eta": "2026-04-14 20:00", "flag": "LR"
    },
    {
        "mmsi": "440201005", "name": "HYUNDAI BRAVE", "callSign": "D5CQ2",
        "type": "화물선", "typeCode": 70,
        "lat": 35.080, "lon": 128.805, "heading": 200, "cog": 198.0,
        "speed": 0, "sog": 0.2, "status": "하역중", "navStatus": 5,
        "length": 294, "width": 32, "draft": 12.0,
        "destination": "BUSAN NEW PORT", "eta": "2026-04-15 14:00", "flag": "KR"
    },
    {
        "mmsi": "440201006", "name": "DONG-A GLAUCOS", "callSign": "DSRB7",
        "type": "화물선", "typeCode": 70,
        "lat": 35.048, "lon": 128.800, "heading": 10, "cog": 12.0,
        "speed": 7.5, "sog": 7.5, "status": "출항중", "navStatus": 0,
        "length": 199, "width": 32, "draft": 10.0,
        "destination": "SHANGHAI", "eta": "2026-04-16 18:00", "flag": "KR"
    },
]

# ──────────────────────────────────────────────────
#  Paths
# ──────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR    = os.path.join(PROJECT_DIR, "src", "data")
TILE_CACHE  = os.path.join(SCRIPT_DIR, ".tile_cache")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(TILE_CACHE, exist_ok=True)

def log(msg):
    sys.stderr.write(f"[generate] {msg}\n")
    sys.stderr.flush()

def save_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    sz = os.path.getsize(path)
    log(f"  saved {filename}  ({sz:,} bytes)")

# ──────────────────────────────────────────────────
#  Tile math helpers
# ──────────────────────────────────────────────────
ZOOM = 15

def lat_lon_to_tile(lat, lon, zoom=ZOOM):
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_rad) + 1.0/math.cos(lat_rad)) / math.pi) / 2.0 * n)
    return x, y

def lat_lon_to_pixel_in_tile(lat, lon, zoom=ZOOM):
    """Return (tile_x, tile_y, px_x, px_y) where px is 0..255 within tile."""
    n = 2 ** zoom
    x_exact = (lon + 180.0) / 360.0 * n
    lat_rad = math.radians(lat)
    y_exact = (1.0 - math.log(math.tan(lat_rad) + 1.0/math.cos(lat_rad)) / math.pi) / 2.0 * n
    tx = int(x_exact)
    ty = int(y_exact)
    px = int((x_exact - tx) * 256)
    py = int((y_exact - ty) * 256)
    px = max(0, min(255, px))
    py = max(0, min(255, py))
    return tx, ty, px, py

def download_tile(tx, ty, zoom=ZOOM):
    """Download a CartoDB dark_matter tile, cache it, return PIL Image."""
    from PIL import Image
    import io
    cache_path = os.path.join(TILE_CACHE, f"{zoom}_{tx}_{ty}.png")
    if os.path.exists(cache_path):
        return Image.open(cache_path)
    url = f"https://basemaps.cartocdn.com/dark_all/{zoom}/{tx}/{ty}.png"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PortMonitor/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            with open(cache_path, "wb") as f:
                f.write(data)
            return Image.open(io.BytesIO(data))
        except Exception as e:
            if attempt < 2:
                time.sleep(1)
            else:
                log(f"  WARN: tile {tx},{ty} download failed: {e}")
                return None
    return None

# ──────────────────────────────────────────────────
#  1. terrain-watermap.json
# ──────────────────────────────────────────────────
def generate_terrain_watermap():
    log("=== 1/6  terrain-watermap.json ===")
    from PIL import Image

    # Build lat/lon grids
    lats = []
    lat = ROI_SOUTH
    while lat <= ROI_NORTH:
        lats.append(round(lat, 8))
        lat += LAT_STEP
    lons = []
    lon = ROI_WEST
    while lon <= ROI_EAST:
        lons.append(round(lon, 8))
        lon += LON_STEP

    log(f"  grid: {len(lats)} lats x {len(lons)} lons = {len(lats)*len(lons):,} points")

    # Determine which tiles we need
    tiles_needed = set()
    for la in lats:
        for lo in lons:
            tx, ty, _, _ = lat_lon_to_pixel_in_tile(la, lo)
            tiles_needed.add((tx, ty))

    log(f"  downloading {len(tiles_needed)} tiles...")
    tile_images = {}
    for i, (tx, ty) in enumerate(sorted(tiles_needed)):
        if i % 20 == 0:
            log(f"    tile {i+1}/{len(tiles_needed)}")
        img = download_tile(tx, ty)
        if img is not None:
            tile_images[(tx, ty)] = img.convert("RGB")

    # Classify water/land
    log("  classifying water/land...")
    waterMap = {}
    for la in lats:
        for lo in lons:
            tx, ty, px, py = lat_lon_to_pixel_in_tile(la, lo)
            key = f"{la},{lo}"
            img = tile_images.get((tx, ty))
            if img is None:
                waterMap[key] = False
                continue
            r, g, b = img.getpixel((px, py))
            # On CartoDB dark_matter at Busan: land is darker (sum~27), water is brighter (sum~114)
            s = r + g + b
            waterMap[key] = (s >= 50)

    water_count = sum(1 for v in waterMap.values() if v)
    land_count  = len(waterMap) - water_count
    log(f"  water: {water_count:,}  land: {land_count:,}")

    # Depth API — gather measured depths
    log("  fetching depth data from API...")
    measured_depths = []   # list of (lat, lon, depth)

    # Split ROI into 0.01° chunks
    lat_chunks = []
    y = int(round(ROI_SOUTH * 100))
    y_max = int(round(ROI_NORTH * 100))
    while y < y_max:
        lat_chunks.append((y / 100.0, min((y + 1) / 100.0, ROI_NORTH)))
        y += 1

    lon_chunks = []
    x = int(round(ROI_WEST * 100))
    x_max = int(round(ROI_EAST * 100))
    while x < x_max:
        lon_chunks.append((x / 100.0, min((x + 1) / 100.0, ROI_EAST)))
        x += 1

    total_chunks = len(lat_chunks) * len(lon_chunks)
    chunk_i = 0
    for lat_lo, lat_hi in lat_chunks:
        for lon_lo, lon_hi in lon_chunks:
            chunk_i += 1
            if chunk_i % 10 == 1:
                log(f"    depth chunk {chunk_i}/{total_chunks}")
            url = (f"{DEPTH_API}?serviceKey={DATA_GO_KR_KEY}&type=json"
                   f"&ymin={lat_lo:.2f}&ymax={lat_hi:.2f}"
                   f"&xmin={lon_lo:.2f}&xmax={lon_hi:.2f}"
                   f"&pageNo=1&numOfRows=500")
            for attempt in range(3):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "PortMonitor/1.0"})
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        body = json.loads(resp.read().decode("utf-8"))
                    items = []
                    if isinstance(body, dict):
                        r = body.get("response", body)
                        bd = r.get("body", {})
                        items_data = bd.get("items", {})
                        if isinstance(items_data, dict):
                            items = items_data.get("item", [])
                        elif isinstance(items_data, list):
                            items = items_data
                    if isinstance(items, dict):
                        items = [items]
                    for it in items:
                        try:
                            d_lat = float(it.get("lat", 0))
                            d_lon = float(it.get("lot", it.get("lon", 0)))
                            d_dep = float(it.get("dpwt", 0))
                            if d_dep != 0:
                                measured_depths.append((d_lat, d_lon, d_dep))
                        except (ValueError, TypeError):
                            pass
                    break
                except Exception as e:
                    if attempt < 2:
                        time.sleep(1)
                    else:
                        log(f"    WARN: depth API failed for chunk: {e}")
            time.sleep(1)

    log(f"  measured depth points: {len(measured_depths)}")

    # IDW interpolation
    log("  IDW interpolation...")
    depthMap = {}

    if measured_depths:
        # Build list for fast lookup
        from bisect import bisect_left

        def idw_depth(target_lat, target_lon):
            """IDW from nearest 25, use top 3."""
            dists = []
            for (ml, mo, md) in measured_depths:
                dlat = (ml - target_lat) * 111000
                dlon = (mo - target_lon) * 88000
                d = math.sqrt(dlat*dlat + dlon*dlon)
                dists.append((d, md))
            dists.sort(key=lambda x: x[0])
            top = dists[:25]
            # pick top 3 by distance
            top3 = top[:3]
            if top3[0][0] < 0.1:
                return top3[0][1]
            w_sum = 0.0
            v_sum = 0.0
            for d, v in top3:
                w = 1.0 / (d * d + 0.001)
                w_sum += w
                v_sum += w * v
            return round(v_sum / w_sum, 2) if w_sum > 0 else 0.0

        water_points = [(la, lo) for la in lats for lo in lons if waterMap.get(f"{la},{lo}", False)]
        log(f"  interpolating {len(water_points):,} water points...")
        for i, (la, lo) in enumerate(water_points):
            if i % 10000 == 0 and i > 0:
                log(f"    {i:,}/{len(water_points):,}")
            depthMap[f"{la},{lo}"] = idw_depth(la, lo)
    else:
        log("  WARN: no measured depths, generating synthetic depths")
        for la in lats:
            for lo in lons:
                key = f"{la},{lo}"
                if waterMap.get(key, False):
                    # Synthetic: deeper toward center
                    dist_lat = abs(la - CENTER_LAT) / (ROI_NORTH - ROI_SOUTH) * 2
                    dist_lon = abs(lo - CENTER_LON) / (ROI_EAST - ROI_WEST) * 2
                    dist = math.sqrt(dist_lat**2 + dist_lon**2)
                    depth = max(1.0, 18.0 - dist * 12.0 + random.uniform(-1, 1))
                    depthMap[key] = round(depth, 2)

    # Smoothing (3 passes)
    log("  smoothing depths (3 passes)...")
    lat_set = set(lats)
    lon_set = set(lons)
    lat_idx = {la: i for i, la in enumerate(lats)}
    lon_idx = {lo: i for i, lo in enumerate(lons)}

    for pass_n in range(3):
        new_depth = {}
        for key, val in depthMap.items():
            parts = key.split(",")
            la = float(parts[0])
            lo = float(parts[1])
            li = lat_idx.get(la)
            loi = lon_idx.get(lo)
            if li is None or loi is None:
                new_depth[key] = val
                continue
            neighbors = [val]
            for di in [-1, 0, 1]:
                for dj in [-1, 0, 1]:
                    if di == 0 and dj == 0:
                        continue
                    ni = li + di
                    nj = loi + dj
                    if 0 <= ni < len(lats) and 0 <= nj < len(lons):
                        nk = f"{lats[ni]},{lons[nj]}"
                        if nk in depthMap:
                            neighbors.append(depthMap[nk])
            new_depth[key] = round(sum(neighbors) / len(neighbors), 2)
        depthMap = new_depth

    result = {
        "lats": lats,
        "lons": lons,
        "waterMap": waterMap,
        "depthMap": depthMap,
    }
    save_json("terrain-watermap.json", result)
    return waterMap, lats, lons

# ──────────────────────────────────────────────────
#  2. buildings-manual.json  (Overpass API)
# ──────────────────────────────────────────────────
def generate_buildings():
    log("=== 2/6  buildings-manual.json ===")
    query = f"""[out:json][timeout:60];
(way["building"]({ROI_SOUTH},{ROI_WEST},{ROI_NORTH},{ROI_EAST}););
out body;>;out skel qt;"""

    features = []
    try:
        data = urllib.parse.urlencode({"data": query}).encode("utf-8")
        req = urllib.request.Request(
            "https://overpass-api.de/api/interpreter",
            data=data,
            headers={"User-Agent": "PortMonitor/1.0"}
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        # Build node lookup
        nodes = {}
        for el in result.get("elements", []):
            if el["type"] == "node":
                nodes[el["id"]] = (el["lon"], el["lat"])

        for el in result.get("elements", []):
            if el["type"] != "way":
                continue
            coords = []
            for nid in el.get("nodes", []):
                if nid in nodes:
                    coords.append(list(nodes[nid]))
            if len(coords) < 3:
                continue
            # Close ring if needed
            if coords[0] != coords[-1]:
                coords.append(coords[0])

            tags = el.get("tags", {})
            height = 8  # default
            if "height" in tags:
                try: height = float(tags["height"])
                except: pass
            elif "building:levels" in tags:
                try: height = int(tags["building:levels"]) * 3.5
                except: pass

            features.append({
                "type": "Feature",
                "properties": {
                    "name": tags.get("name", ""),
                    "building": tags.get("building", "yes"),
                    "height": height,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords],
                }
            })

        log(f"  fetched {len(features)} buildings from Overpass")
    except Exception as e:
        log(f"  WARN: Overpass failed: {e}, creating empty collection")

    result = {"type": "FeatureCollection", "features": features}
    save_json("buildings-manual.json", result)
    return features

# ──────────────────────────────────────────────────
#  3. building-colors.json
# ──────────────────────────────────────────────────
def generate_building_colors(features):
    log("=== 3/6  building-colors.json ===")
    colors = {}
    random.seed(42)
    for feat in features:
        coords = feat.get("geometry", {}).get("coordinates", [[]])[0]
        if not coords:
            continue
        # Use centroid as key (like existing format: "lat,lon")
        avg_lon = sum(c[0] for c in coords) / len(coords)
        avg_lat = sum(c[1] for c in coords) / len(coords)
        key = f"{avg_lat:.5f},{avg_lon:.5f}"
        btype = feat.get("properties", {}).get("building", "yes")
        if btype in ("warehouse", "industrial"):
            colors[key] = [random.randint(80, 160), random.randint(100, 140), random.randint(90, 130)]
        elif btype == "office":
            colors[key] = [random.randint(130, 180), random.randint(140, 190), random.randint(160, 200)]
        else:
            colors[key] = [random.randint(80, 170), random.randint(90, 170), random.randint(80, 170)]
    save_json("building-colors.json", colors)

# ──────────────────────────────────────────────────
#  4. current-vectors.json
# ──────────────────────────────────────────────────
def generate_current_vectors(waterMap, lats, lons):
    log("=== 4/6  current-vectors.json ===")
    random.seed(123)

    # Collect water points, sample ~150 positions
    water_coords = []
    for la in lats:
        for lo in lons:
            if waterMap.get(f"{la},{lo}", False):
                water_coords.append((la, lo))

    # Sample ~150 positions across water area
    target_positions = 150
    if len(water_coords) > target_positions:
        step = len(water_coords) // target_positions
        sampled = water_coords[::step][:target_positions]
    else:
        sampled = water_coords

    log(f"  {len(sampled)} vector positions from {len(water_coords)} water points")

    hours_data = {}
    for hour in range(24):
        # Tide model: 6h flood (0-5, 12-17), 6h ebb (6-11, 18-23)
        cycle_pos = (hour % 12) / 6.0   # 0..2
        if cycle_pos < 1.0:
            # Flood tide (rising)
            base_dir = FLOOD_DIR
            tide_strength = math.sin(cycle_pos * math.pi)  # 0..1..0
            status = "flood"
        else:
            # Ebb tide (falling)
            base_dir = EBB_DIR
            tide_strength = math.sin((cycle_pos - 1.0) * math.pi)
            status = "ebb"

        vectors = []
        for (la, lo) in sampled:
            # Add spatial variation
            spatial_var = math.sin(la * 1000) * 15 + math.cos(lo * 1000) * 10

            for layer, speed_mult, dir_offset in [
                ("surface", 1.0,  0),
                ("mid",     0.6, -10),
                ("bottom",  0.3, -20),
            ]:
                speed = round(max(0.05, tide_strength * (0.5 + random.uniform(0, 0.5)) * speed_mult), 2)
                direction = round((base_dir + spatial_var + dir_offset + random.uniform(-5, 5)) % 360, 1)
                vectors.append({
                    "lat": la,
                    "lon": lo,
                    "speed": speed,
                    "direction": direction,
                    "layer": layer,
                })

        hours_data[str(hour)] = vectors

    result = {"hours": hours_data, "meta": {"generated": "generate-project.py", "roi": PROJECT_NAME}}
    save_json("current-vectors.json", result)

# ──────────────────────────────────────────────────
#  5. vessels.json
# ──────────────────────────────────────────────────
def generate_vessels():
    log("=== 5/6  vessels.json ===")
    result = {"vessels": VESSELS}
    save_json("vessels.json", result)

# ──────────────────────────────────────────────────
#  6. tide-cache.json
# ──────────────────────────────────────────────────
def generate_tide_cache():
    log("=== 6/6  tide-cache.json ===")
    # Generate 24-hour synthetic tide data for Busan area
    # Busan tidal range ~1.2m, semi-diurnal
    records = []
    base_level = 100.0   # cm above chart datum
    amplitude  = 60.0    # cm

    from datetime import datetime, timedelta
    now = datetime(2026, 4, 14, 0, 0, 0)

    for h in range(24):
        t = now + timedelta(hours=h)
        # Semi-diurnal tide model
        level = base_level + amplitude * math.sin(2 * math.pi * h / 12.25 - math.pi / 3)
        level = round(level, 1)

        # Predicted (slightly different)
        predicted = round(level + random.uniform(-3, 3), 1)

        records.append({
            "stationName": STATION_NAME,
            "lat": STATION_LAT,
            "lon": STATION_LON,
            "datetime": t.strftime("%Y-%m-%d %H:%M"),
            "measured": level,
            "predicted": predicted,
        })

    result = {"records": records}
    save_json("tide-cache.json", result)

# ──────────────────────────────────────────────────
#  Main
# ──────────────────────────────────────────────────
def main():
    log(f"Project: {PROJECT_NAME}")
    log(f"ROI: N={ROI_NORTH} S={ROI_SOUTH} W={ROI_WEST} E={ROI_EAST}")
    log(f"Center: {CENTER_LAT}, {CENTER_LON}")
    log(f"Data dir: {DATA_DIR}")
    log("")

    waterMap, lats, lons = generate_terrain_watermap()
    features = generate_buildings()
    generate_building_colors(features)
    generate_current_vectors(waterMap, lats, lons)
    generate_vessels()
    generate_tide_cache()

    log("")
    log("Done! All data files generated.")

if __name__ == "__main__":
    main()
