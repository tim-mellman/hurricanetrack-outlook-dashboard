# HurricaneTrack Outlook Dashboard — Project Handoff Document

This document brings a new Claude instance fully up to speed on the HurricaneTrack Outlook Dashboard project. Read it completely before writing any code. The user will also share images of existing HurricaneTrack graphics and a prototype HTML file for visual reference.

---

## Project Overview

**What this is:** An interactive web dashboard for HurricaneTrack Insiders (weather enthusiasts who support HurricaneTrack via Patreon). It tracks and compares Atlantic hurricane season outlooks from multiple forecast agencies, shows historical forecast accuracy, and displays current season statistics.

**Context:** HurricaneTrack already has an Insider portal at `insider.hurricanetrack.com` (PHP-based, MySQL backend). This dashboard is being built independently first, then will be merged into the existing site later. For now it operates as a standalone site with no login requirement.

**The user** has Python experience but minimal web development experience. Code should be explained clearly. The user wants to deeply understand what is being built.

---

## Design Specification

### Branding
- **Fonts:** Norwester (headings — self-hosted, OFL licensed), Montserrat (body — Google Fonts, OFL licensed)
- **Style:** Dark, dramatic, data-dense. Reference the attached HurricaneTrack graphics for tone. Not "AI-looking" — confident, branded, weather-professional.
- **Must look good on both desktop and mobile** — mobile nav is required (hamburger or bottom nav)

### Color Palette
```css
/* Brand / metric colors */
--bg:           #0d0f11;
--surface:      #141618;
--surface2:     #1b1e21;
--surface3:     #222529;
--border:       rgba(255,255,255,0.07);
--text:         #edeae3;
--muted:        rgba(237,234,227,0.45);
--accent:       #fbb03b;   /* orange — primary accent */

/* Storm metric colors */
--named:        #4e8cca;   /* named storms / tropical storms */
--hurr:         #fbb03b;   /* hurricanes */
--major:        #db3727;   /* major hurricanes */
--ace:          #a78bfa;   /* ACE (purple — may be updated later) */

/* Storm timeline — intensity by category */
--cat-ts:       #4e8cca;   /* tropical storm */
--cat-1:        #4ade80;   /* green */
--cat-2:        #facc15;   /* yellow */
--cat-3:        #fbb03b;   /* orange (same as hurr) */
--cat-4:        #db3727;   /* red (same as major) */
--cat-5:        #f472b6;   /* pink */
```

---

## Pages

| File | Route | Purpose |
|------|-------|---------|
| `index.html` | `/` | Main dashboard — outlook comparison for selected year |
| `outlook.html` | `/outlook.html?src=noaa_may` | Historical performance for one source |
| `season.html` | `/season.html?year=2026` | Current season storms, timeline, ACE curves |
| `compare.html` | `/compare.html` | HT Skill Index rankings, head-to-head source comparison |
| `admin.html` | `/admin.html` | Password-protected data entry panel |

---

## Main Dashboard (`index.html`) — Detailed Spec

This is the core product. Two charts side by side (or stacked on mobile):

**Chart 1: Storm Count Outlooks**
- X-axis: each outlook source in chronological order (see source list below), plus "YYYY Actual" column on the far right
- Y-axis: storm count (0–30 or so)
- Each source column shows:
  - A **dot** (point estimate) or **vertical bar spanning lo–hi** (range) for named storms, hurricanes, and major hurricanes — three markers per column, color-coded
  - If a source doesn't predict major hurricanes (ECMWF), only two markers
- **Horizontal dashed lines** across the full chart width for climatological averages: named=14, hurr=7, major=3
- **Actual column** on the right shows season-to-date actual counts as a distinct marker style (e.g. square vs. circle)
- Column **labels are clickable** and navigate to `outlook.html?src=[source_id]`
- **Year picker** at top, defaults to current year (2026)

**Chart 2: ACE Outlooks**
- Same column structure
- Each column shows ACE prediction as dot or range bar
- Some sources (CSU, 2023+) also show ACE west of 60°W — display as a secondary smaller/hollow marker below the main ACE marker
- Horizontal dashed lines for ACE avg (123) and ACE west of 60°W avg (73)
- Background shading: above-normal (>150, red-tinted), near-normal (75–150, subtle), below-normal (<75, blue-tinted)

**Visual reference:** See attached images — `HT25_-_Seasonal_Forecasts_Full_Season.jpg` and `HT25_-_Seasonal_Forecasts_Full_Season_ACE.jpg`. Match that overall layout and feel, modernised.

---

## Outlook Sources

In chronological order (this is the X-axis order on the main chart):

| ID | Label | Sublabel | Has Range | Has Major | Has ACE w60 | Start Year |
|----|-------|----------|-----------|-----------|-------------|------------|
| `csu_apr` | CSU | April | No | Yes | Yes (2023+) | 2008 |
| `ecmwf_may` | ECMWF | May | Yes | No | No | 2017 |
| `ukmet_may` | UK Met | May | No | Yes | No | 2011 |
| `noaa_may` | NOAA | May | No | Yes | No | 2008 |
| `csu_jun` | CSU | June | No | Yes | Yes (2023+) | 2008 |
| `csu_jul` | CSU | July | No | Yes | Yes (2023+) | 2015 |
| `ukmet_aug` | UK Met | August | No | Yes | No | 2011 |
| `csu_aug` | CSU | August | No | Yes | Yes (2023+) | 2008 |
| `noaa_aug` | NOAA | August | No | Yes | No | 2008 |

**Flexibility note:** The database and UI must support adding new sources without code changes — source metadata lives in `sources.json`.

---

## Season Stats Page (`season.html`)

- Year picker, defaults to current year
- Summary cards: named storms, hurricanes, major hurricanes, ACE, ACE west of 60°W
- **Storm timeline graphic** (like the Wikipedia image attached — `image.png`): horizontal Gantt-style chart, one bar per storm, colored by peak intensity category, spanning start to end date, labeled with storm name and peak category
- **Cumulative ACE curve**: line chart of running ACE total by date through the season, overlaid with the historical average cumulative curve and ±1 std dev band
- **Smoothed ACE density curve**: how ACE was distributed over time through the season (smoothed, not raw), vs. historical average distribution

---

## Outlook Detail Page (`outlook.html?src=noaa_may`)

- Header: source name, sublabel, record length
- **Historical storm count chart** (2008/2011/2017–present): predicted vs. actual for named, hurr, major — matching the style of the attached prototype HTML (`hurricanetrack-dashboard.html`)
- **Historical ACE chart**: same structure
- **Skill score display**: HT Skill Index (0–100, letter grade A–D), with sub-scores for named, hurr, major, ACE. See formula below.
- Brief plain-English explanation of what the scores mean (audience = enthusiasts, not statisticians)

---

## Compare Page (`compare.html`)

- Ranked table of all sources by HT Skill Index
- Head-to-head bar/dot chart comparing all sources' skill sub-scores side by side
- Option to filter by metric (named only, ACE only, etc.)

---

## HT Skill Index Formula

For each category C in {named, hurr, major, ace} where data is available:

```
error_C        = |predicted - actual|
climo_error_C  = |climatological_average - actual|   ← baseline: "just guess the average"
skill_C        = max(0, 1 - error_C / climo_error_C) ← 1.0 = perfect, 0 = no better than climatology
```

Bias penalty: if `|mean_bias| > 1 std dev` of errors, multiply skill_C by 0.85.

`HT_Skill_Index = weighted average of skill_C across available categories`

Display as 0–100. Letter grade: 85+ = A, 70+ = B, 55+ = C, below = D.

**Note:** Formula is v1 and intentionally tunable. Keep the calculation in one place (`js/skills.js` or equivalent) so it's easy to adjust.

---

## Admin Panel (`admin.html`)

Password-protected (default password: `hurricanetrack2025` — user can change this).

Sections:
1. **Current season actuals** — named, hurr, major, ACE, ACE w60 (season-to-date counts)
2. **2026 outlook predictions** — one sub-tab per source, fields for each metric (lo/hi for range sources, single value for point estimate sources)
3. **Historical actuals** — grid of past verified post-season totals by year
4. **Storm records** — add/edit individual storm entries for the timeline (name, start date, end date, peak category, peak winds)

Data saves to browser `localStorage` for the standalone dev version. When merged into the HurricaneTrack server, the save action will POST to a PHP endpoint instead — design the admin JS so this swap is a one-line change (swap `localStorage.setItem(...)` for `fetch('/api/save.php', ...)`).

---

## Architecture

### Dev (standalone — build this first)
```
hurricanetrack-dashboard/
├── index.html
├── outlook.html
├── season.html
├── compare.html
├── admin.html
├── fonts/
│   └── Norwester.woff2        ← self-hosted (download from author's site)
├── css/
│   └── style.css              ← all styles, CSS variables at top
├── js/
│   ├── data.js                ← loads JSON files, exposes getData() functions
│   ├── charts.js              ← all Chart.js rendering functions
│   ├── dashboard.js           ← index.html logic
│   ├── outlook.js             ← outlook.html logic
│   ├── season.js              ← season.html logic
│   ├── compare.js             ← compare.html logic
│   ├── admin.js               ← admin.html logic
│   └── skills.js              ← HT Skill Index calculation
├── data/
│   ├── sources.json           ← source metadata
│   ├── predictions.json       ← all predictions, all sources, all years
│   ├── actuals.json           ← verified post-season totals
│   ├── storms.json            ← individual storm records
│   └── ace_daily.json         ← cumulative ACE by date per season (generated by Python)
└── scripts/
    └── nhc_sync.py            ← Python automation script
```

### Prod (future — when merged into HurricaneTrack server)
- MySQL replaces JSON files
- PHP endpoints (`api/*.php`) replace JSON fetches
- Python cron job replaces manual `nhc_sync.py` runs
- Frontend JS unchanged (only the fetch URLs change)

---

## Data File Formats

### `sources.json`
```json
[
  {
    "id": "csu_apr",
    "label": "CSU",
    "sublabel": "April",
    "color": "#4ade80",
    "start_year": 2008,
    "has_range": false,
    "has_major": true,
    "has_ace_w60": true
  }
]
```

### `predictions.json`
Point estimates use `lo == hi`. Ranges use different values. Missing data uses `null`.
```json
[
  {
    "source_id": "noaa_may",
    "year": 2026,
    "named_lo": 17, "named_hi": 17,
    "hurr_lo": 9,   "hurr_hi": 9,
    "major_lo": 4,  "major_hi": 4,
    "ace_lo": 155,  "ace_hi": 175,
    "ace_w60_lo": null, "ace_w60_hi": null
  }
]
```

### `actuals.json`
```json
[
  {
    "year": 2025,
    "named": 18,
    "hurr": 11,
    "major": 5,
    "ace": 152,
    "ace_w60": 98
  }
]
```

### `storms.json`
```json
[
  {
    "year": 2025,
    "name": "Beryl",
    "start": "2025-06-28",
    "end": "2025-07-09",
    "peak_category": 5,
    "peak_winds_mph": 165,
    "ace_contribution": 28.4
  }
]
```

### `ace_daily.json`
Generated by `nhc_sync.py` from HURDAT2. Not edited manually.
```json
[
  {
    "year": 2019,
    "data": [
      { "date": "2019-06-01", "cumulative_ace": 0 },
      { "date": "2019-07-04", "cumulative_ace": 12.3 }
    ]
  }
]
```

---

## Python Automation (`nhc_sync.py`)

Two modes:

**Mode 1: Historical backfill** (run once to generate `ace_daily.json`)
- Download HURDAT2 from `https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2024-050425.txt`
- For each season 2004–present, parse 6-hourly storm records, compute cumulative ACE day by day
- ACE formula: `ACE = (max_sustained_wind_knots)² × 10⁻⁴` per 6-hour period, only when storm is tropical storm or hurricane intensity (≥35 knots)
- Write to `data/ace_daily.json`

**Mode 2: Live sync** (to be run on cron during June–November, once the server is set up)
- Fetch `https://www.nhc.noaa.gov/CurrentStorms.json`
- Parse active Atlantic storms, update current year's row in `actuals.json` and `storms.json`
- Append new data points to current year in `ace_daily.json`

---

## Climatological Averages (1991–2020)

| Metric | Average |
|--------|---------|
| Named storms | 14 |
| Hurricanes | 7 |
| Major hurricanes | 3 |
| ACE | 123 |
| ACE west of 60°W | 73 |

---

## Recommended Build Order

1. `nhc_sync.py` historical backfill → generates `ace_daily.json`
2. Seed all `data/*.json` files with historical data
3. `index.html` + `dashboard.js` — main outlook comparison chart (core product)
4. `season.html` + `season.js` — storm timeline + ACE curves
5. `outlook.html` + `outlook.js` + `skills.js` — detail + skill scores
6. `compare.html` + `compare.js` — rankings
7. `admin.html` + `admin.js` — data entry panel
8. Mobile polish, nav, final design pass across all pages

---

## Teaching Note

The user is learning web development as they go. When writing code, please:
- Explain what each file does and why it exists before writing it
- Explain key decisions (e.g. why data is in JSON vs hardcoded, why JS is split into multiple files)
- Check for understanding before moving to the next file
- Use the Socratic / mastery-check teaching approach: have the user restate their understanding, quiz them, don't move on until they've demonstrated comprehension
- Keep a running checklist of concepts the user should understand

---

## What's Already Built

A single-file HTML prototype exists (`hurricanetrack-dashboard.html`, attached). It demonstrates:
- The dark HurricaneTrack visual style in a web context
- Chart.js usage for the outlook vs. actuals charts
- The source selector and compare mode toggle
- The ACE activity bands chart
- A basic admin panel with localStorage persistence
- The skill scores layout

The prototype is **inspirational, not canonical** — the production site uses the multi-file architecture above. Do not try to adapt the prototype directly; build fresh from this spec.
