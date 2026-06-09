#!/usr/bin/env python3
"""
nhc_sync.py — HurricaneTrack ACE data sync

Mode 1 (run once):  backfill   — downloads HURDAT2, computes cumulative ACE
                                  by date for each season 2004–present,
                                  writes data/ace_daily.json

Mode 2 (cron):      live       — fetches NHC CurrentStorms.json, updates
                                  data/actuals.json and data/storms.json
                                  for the current season

Usage:
    python3 scripts/nhc_sync.py backfill
    python3 scripts/nhc_sync.py live

Run from the hurricanetrack-dashboard/ directory.

ACE formula:
    ACE += (max_sustained_wind_knots ** 2) * 1e-4
    for each 6-hour period where storm status is tropical storm or hurricane
    (sustained winds >= 35 knots, status not 'DB', 'LO', 'EX', 'WV', 'PT')
"""

import json
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────

ROOT      = Path(__file__).resolve().parent.parent
DATA_DIR  = ROOT / 'data'

HURDAT2_DIR     = 'https://www.nhc.noaa.gov/data/hurdat/'
HURDAT2_URL     = None   # discovered at runtime via find_hurdat2_url()
CURRENT_URL     = 'https://www.nhc.noaa.gov/CurrentStorms.json'
ACE_DAILY_FILE  = DATA_DIR / 'ace_daily.json'
ACTUALS_FILE    = DATA_DIR / 'actuals.json'
STORMS_FILE     = DATA_DIR / 'storms.json'

# Seasons to include in the backfill
BACKFILL_START = 2004
BACKFILL_END   = 2025   # update this each year after the season ends

# Only Atlantic basin storms (identifier prefix 'AL')
BASIN = 'AL'

# Statuses that count toward ACE.
# NOAA includes subtropical storms (SS) in seasonal ACE totals alongside tropical
# storms (TS) and hurricanes (HU).  Pacific basin statuses (TY, TH) should not
# appear in Atlantic HURDAT2 and are excluded.
ACE_STATUSES = {'TS', 'HU', 'SS'}


# ──────────────────────────────────────────────────────────────────────────
#  MODE 1: Historical backfill
# ──────────────────────────────────────────────────────────────────────────

def find_hurdat2_url():
    """
    Find the current Atlantic HURDAT2 file URL.

    Strategy:
    1. Fetch NHC directory listing and parse filenames.
    2. If that fails, try a sequence of known recent filenames until one works.
    """
    # Step 1: try directory listing
    try:
        html = fetch_url(HURDAT2_DIR)
        matches = re.findall(r'href="(hurdat2-1851-\d{4}-\d+\.txt)"', html)
        if matches:
            matches.sort()
            chosen = matches[-1]
            url = HURDAT2_DIR + chosen
            print(f'Found via directory listing: {chosen}')
            return url
        print('Directory listing returned no matches, trying known URLs …')
    except Exception as e:
        print(f'Directory listing failed ({e}), trying known URLs …')

    # Step 2: try a list of known recent filenames (newest first)
    known = [
        'hurdat2-1851-2025-02272026.txt',  # confirmed current as of 2026
        'hurdat2-1851-2025-040626.txt',
        'hurdat2-1851-2025-012526.txt',
        'hurdat2-1851-2024-050425.txt',    # last known good prior to 2025 update
    ]
    for filename in known:
        url = HURDAT2_DIR + filename
        try:
            # HEAD-style probe: open but read only 1 byte to confirm it exists
            req = urllib.request.Request(url, headers={'User-Agent': 'HurricaneTrack-Dashboard/1.0'},
                                         method='HEAD')
            urllib.request.urlopen(req, timeout=10)
            print(f'Found via probe: {filename}')
            return url
        except Exception:
            continue

    raise RuntimeError(
        'Could not locate HURDAT2 file. Visit https://www.nhc.noaa.gov/data/hurdat/ '
        'in a browser, copy the filename of the most recent hurdat2-1851-*.txt file, '
        'and update HURDAT2_DIR + filename in this script.'
    )


def backfill():
    print('Discovering current HURDAT2 file …')
    url = find_hurdat2_url()
    print(f'Downloading {url} …')
    hurdat_text = fetch_url(url)
    print(f'Downloaded {len(hurdat_text):,} bytes. Parsing …')

    storms_by_year = parse_hurdat2(hurdat_text)
    print(f'Parsed {sum(len(v) for v in storms_by_year.values())} storm tracks across {len(storms_by_year)} seasons')

    results = []

    for year in range(BACKFILL_START, BACKFILL_END + 1):
        storms = storms_by_year.get(year, [])
        daily = compute_cumulative_ace(year, storms)
        results.append({'year': year, 'data': daily})
        # Named storms are those assigned an official name (HURDAT2 uses 'UNNAMED' for TDs)
        named_count = sum(1 for s in storms if s['name'] != 'UNNAMED')
        total_ace = daily[-1]['cumulative_ace']
        per_storm = storm_ace_contributions(storms)
        top = sorted(per_storm.items(), key=lambda x: -x[1])[:4]
        top_str = '  '.join(f'{n} {a:.1f}' for n, a in top)
        print(f'  {year}: {named_count} named storms, ACE {total_ace:.1f}  [{top_str}]')

    write_json(ACE_DAILY_FILE, results)
    print(f'\nWrote {ACE_DAILY_FILE}')


def parse_lon(raw):
    """Parse HURDAT2 longitude string ("83.9W", "12.3E") → signed float (-83.9, 12.3)."""
    raw = raw.strip()
    if raw.endswith('W'):
        return -float(raw[:-1])
    elif raw.endswith('E'):
        return float(raw[:-1])
    return float(raw)


def parse_hurdat2(text):
    """
    Parse HURDAT2 format and return dict: { year -> list of storm dicts }.

    Each storm dict:
        { 'id': str, 'name': str, 'records': list of record dicts }

    Each record dict:
        { 'dt': datetime, 'status': str, 'wind_kt': int }
    """
    storms_by_year = {}
    current_storm  = None
    current_year   = None

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Header line: "AL012005, KATRINA, 28,"
        if re.match(r'^[A-Z]{2}\d{6},', line):
            parts = [p.strip() for p in line.split(',')]
            storm_id   = parts[0]
            storm_name = parts[1]

            basin  = storm_id[:2]
            year   = int(storm_id[4:8])

            if basin != BASIN or year < BACKFILL_START or year > BACKFILL_END:
                current_storm = None
                continue

            current_storm = {'id': storm_id, 'name': storm_name, 'records': []}
            current_year  = year

            if year not in storms_by_year:
                storms_by_year[year] = []
            storms_by_year[year].append(current_storm)

        # Data line: "20050823, 1800, L, TS, 23.1N, 75.1W, 045, 987, ..."
        elif current_storm is not None:
            parts = [p.strip() for p in line.split(',')]
            if len(parts) < 8:
                continue

            date_str = parts[0]   # YYYYMMDD
            time_str = parts[1]   # HHMM
            status   = parts[3]   # HU, TS, TD, EX, …

            try:
                dt = datetime.strptime(date_str + time_str.zfill(4), '%Y%m%d%H%M')
            except ValueError:
                continue

            try:
                wind_kt = int(parts[6].strip())
            except (ValueError, IndexError):
                wind_kt = 0

            try:
                lon = parse_lon(parts[5])
            except (ValueError, IndexError):
                lon = 0.0

            current_storm['records'].append({
                'dt':      dt,
                'status':  status,
                'wind_kt': wind_kt,
                'lon':     lon,
            })

    return storms_by_year


def _ace_eligible(rec):
    """True if a record should contribute to Atlantic ACE."""
    SYNOPTIC_HOURS = {0, 6, 12, 18}
    if rec['dt'].hour not in SYNOPTIC_HOURS or rec['dt'].minute != 0:
        return False
    if rec['status'] not in ACE_STATUSES:
        return False
    if rec['wind_kt'] < 35:
        return False
    # Exclude records where the storm has crossed into the Eastern Pacific
    # (west of 100°W).  Trans-basin storms like Bonnie 2022 are tracked under
    # their Atlantic ID but their Pacific intensification should not count.
    if rec.get('lon', 0.0) < -100.0:
        return False
    return True


def storm_ace_contributions(storms):
    """Return {storm_name: total_ace} for diagnostic output."""
    result = {}
    for storm in storms:
        total = sum((r['wind_kt'] ** 2) * 1e-4 for r in storm['records'] if _ace_eligible(r))
        if total > 0:
            result[storm['name']] = round(total, 2)
    return result


def compute_cumulative_ace(year, storms):
    """
    Build a daily cumulative ACE series covering the full calendar year so
    that off-season storms (e.g. May or December storms) are included.

    Only the four standard synoptic observation times (0000, 0600, 1200, 1800 UTC)
    are counted.  HURDAT2 also contains special observations at other hours
    (made during landfall or rapid intensification); including those would
    double-count ACE for parts of the 6-hour window they fall inside.

    Returns a list of { 'date': 'YYYY-MM-DD', 'cumulative_ace': float }.
    """
    # Build a dict: date -> ACE contribution on that date
    ace_by_date = {}

    for storm in storms:
        for rec in storm['records']:
            if not _ace_eligible(rec):
                continue
            ace = (rec['wind_kt'] ** 2) * 1e-4
            day = rec['dt'].date()
            ace_by_date[day] = ace_by_date.get(day, 0.0) + ace

    # Walk Jan 1 → Dec 31 so no off-season storm ACE is missed
    start = date(year, 1, 1)
    end   = date(year, 12, 31)
    cumulative = 0.0
    result = []
    current = start

    while current <= end:
        cumulative += ace_by_date.get(current, 0.0)
        result.append({
            'date':            current.isoformat(),
            'cumulative_ace':  round(cumulative, 2),
        })
        current += timedelta(days=1)

    return result


# ──────────────────────────────────────────────────────────────────────────
#  MODE 2: Live sync
# ──────────────────────────────────────────────────────────────────────────

def live():
    current_year = date.today().year
    print(f'Fetching current storms for {current_year} …')

    try:
        payload = json.loads(fetch_url(CURRENT_URL))
    except Exception as e:
        print(f'Failed to fetch CurrentStorms.json: {e}')
        sys.exit(1)

    active_storms = [
        s for s in payload.get('activeStorms', [])
        if s.get('basin', '').upper() == 'AL'
    ]
    print(f'Active Atlantic storms: {len(active_storms)}')

    actuals  = read_json(ACTUALS_FILE)
    storms   = read_json(STORMS_FILE)
    ace_data = read_json(ACE_DAILY_FILE)

    # Update actuals counts from active storm list
    named = sum(1 for s in active_storms if s.get('classification') in ('TS', 'HU', 'TY'))
    hurr  = sum(1 for s in active_storms if s.get('classification') == 'HU')
    # NHC CurrentStorms doesn't give historical totals; print what we see live
    print(f'  Current active: {named} named, {hurr} hurricanes (season totals must be updated manually)')

    # Update or create storm records for any active storms
    for s in active_storms:
        storm_id   = s.get('id', '')
        storm_name = s.get('name', 'Unknown')
        classfn    = s.get('classification', 'TD')
        winds_mph  = int(s.get('maxWindMph', 0))
        winds_kt   = int(winds_mph * 0.868976)

        # Map classification → category
        cat = classify_category(winds_kt, classfn)

        # Find existing record for this storm (by name + year)
        existing = next(
            (st for st in storms if st['year'] == current_year and st['name'].lower() == storm_name.lower()),
            None
        )

        if existing:
            # Update peak intensity if higher
            if winds_mph > (existing.get('peak_winds_mph') or 0):
                existing['peak_winds_mph'] = winds_mph
                existing['peak_category']  = cat
        else:
            # Add new storm record (start date unknown from this endpoint; use today)
            storms.append({
                'year':            current_year,
                'name':            storm_name,
                'start':           date.today().isoformat(),
                'end':             date.today().isoformat(),
                'peak_category':   cat,
                'peak_winds_mph':  winds_mph,
                'ace_contribution': None,
            })

    write_json(STORMS_FILE, storms)
    print(f'Updated {STORMS_FILE}')

    # Note: season totals (actuals.json) must be updated via the admin panel
    # because CurrentStorms.json only shows active storms, not cumulative counts.
    print('Tip: update season totals (named, hurr, major, ACE) via the admin panel.')


def classify_category(wind_kt, status):
    """Saffir-Simpson scale by 1-minute sustained wind (knots)."""
    if status in ('TD', 'LO', 'DB'):
        return 0
    if wind_kt < 64:
        return -1   # tropical storm (we use -1 to mean TS in storms.json)
    if wind_kt < 83:
        return 1
    if wind_kt < 96:
        return 2
    if wind_kt < 113:
        return 3
    if wind_kt < 137:
        return 4
    return 5


# ──────────────────────────────────────────────────────────────────────────
#  Utilities
# ──────────────────────────────────────────────────────────────────────────

def fetch_url(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'HurricaneTrack-Dashboard/1.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8', errors='replace')


def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        f.write('\n')


# ──────────────────────────────────────────────────────────────────────────
#  Entry point
# ──────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('backfill', 'live'):
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == 'backfill':
        backfill()
    else:
        live()
