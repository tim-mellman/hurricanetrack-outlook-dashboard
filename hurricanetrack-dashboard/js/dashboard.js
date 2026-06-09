/**
 * dashboard.js — index.html page logic
 *
 * Builds items[] for the selected year (one entry per visible source + actual),
 * passes it to makeOutlookChart() twice (storms + ACE), and renders summary cards.
 */

let selectedYear = new Date().getFullYear();
let chartStorms  = null;
let chartAce     = null;

document.addEventListener('DOMContentLoaded', async () => {
  const db = await getData();
  initYearPicker(db);
  // initYearPicker ends with update() which calls render(), so no second call needed
});

function initYearPicker(db) {
  const display = document.getElementById('yearDisplay');
  const prev    = document.getElementById('yearPrev');
  const next    = document.getElementById('yearNext');

  const years   = [...new Set(db.predictions.map(p => p.year))].sort();
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  function update() {
    display.textContent = selectedYear;
    const heroYear = document.getElementById('heroYear');
    if (heroYear) heroYear.textContent = selectedYear;
    prev.disabled = selectedYear <= minYear;
    next.disabled = selectedYear >= maxYear;
    render(db);
  }

  prev.addEventListener('click', () => { selectedYear--; update(); });
  next.addEventListener('click', () => { selectedYear++; update(); });
  update();
}

function render(db) {
  // Season pill: only show for the current calendar year
  const pill = document.getElementById('seasonPill');
  if (pill) pill.style.display = (selectedYear === new Date().getFullYear()) ? '' : 'none';

  renderSummaryCards(db);

  // Rebuild charts from scratch each year change
  chartStorms = destroyChart(chartStorms);
  chartAce    = destroyChart(chartAce);

  const items = buildItems(db);

  // If no predictions exist for this year, leave canvases blank
  if (items.filter(it => !it.isActual).length === 0) return;

  chartStorms = makeOutlookChart(document.getElementById('chartStorms'), { items, mode: 'storms' });
  chartAce    = makeOutlookChart(document.getElementById('chartAce'),    { items, mode: 'ace'    });

  renderSourceLabels('stormLabels', items);
  renderSourceLabels('aceLabels',   items);

  alignSourceChips(chartStorms, 'stormLabels', items);
  alignSourceChips(chartAce,    'aceLabels',   items);
}

// ── Source chip alignment ─────────────────────────────────────────────────────
// Syncs the chip row's horizontal padding to the chart's y-axis area so each
// chip sits directly below its column.

function alignSourceChips(chart, containerId, items) {
  const el = document.getElementById(containerId);
  if (!el || !chart || !chart.chartArea) return;

  // On narrow viewports the chips can't fit in column-width cells — let them wrap freely.
  if (window.innerWidth < 768) return;

  const { left: areaLeft, right: areaRight } = chart.chartArea;
  el.style.paddingLeft  = areaLeft + 'px';
  el.style.paddingRight = (chart.canvas.offsetWidth - areaRight) + 'px';
  el.style.display = 'grid';
  el.style.gridTemplateColumns = `repeat(${items.length}, 1fr)`;
  el.style.justifyItems = 'center';
  el.style.gap = '0';
}

// ── Source label chip buttons ─────────────────────────────────────────────────
// Rendered below each chart; clicking a source chip navigates to its detail page.

function renderSourceLabels(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = items.map(item => {
    if (item.isActual) {
      return `<div class="source-chip actual-chip">
        <strong>${item.label}</strong>
        <span>${item.sublabel}</span>
      </div>`;
    }
    return `<a href="outlook.html?src=${item.id}" class="source-chip"
               style="border-color:${item.color};color:${item.color}">
        <strong>${item.label}</strong>
        <span>${item.sublabel}</span>
      </a>`;
  }).join('');
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function renderSummaryCards(db) {
  const actual = db.getActual(selectedYear);
  const el     = document.getElementById('summaryCards');
  if (!el) return;

  const fmtInt = v => v == null ? '—' : v;
  const fmtAce = v => v == null ? '—' : (Number.isInteger(v) ? v : v.toFixed(1));

  const cards = [
    { key: 'named',   label: 'Named Storms', fmt: fmtInt, color: 'var(--named)'  },
    { key: 'hurr',    label: 'Hurricanes',    fmt: fmtInt, color: 'var(--hurr)'   },
    { key: 'major',   label: 'Major',         fmt: fmtInt, color: 'var(--major)'  },
    { key: 'ace',     label: 'ACE',           fmt: fmtAce, color: 'var(--ace)'    },
    { key: 'ace_w60', label: 'ACE west 60°W', fmt: fmtAce, color: 'var(--ace)'    },
  ];

  el.innerHTML = cards.map(({ key, label, fmt, color }) => {
    const val = actual?.[key] ?? null;
    return `<div class="summary-card">
      <div class="summary-card-label">${label}</div>
      <div class="summary-card-value" style="color:${color}">${fmt(val)}</div>
    </div>`;
  }).join('');
}

// ── Build items array for the selected year ───────────────────────────────────
//
// items[] has one object per x-axis column: one per source that issued a
// forecast for this year, plus the actual column at the end.

function buildItems(db) {
  const actual = db.getActual(selectedYear);
  const items  = [];

  for (const src of db.sources) {
    if (src.start_year > selectedYear) continue;

    const pred = db.getPrediction(src.id, selectedYear);
    if (!pred) continue;

    // Skip rows where every value is null (source didn't issue this year)
    if (pred.named_lo == null && pred.hurr_lo == null && pred.ace_lo == null) continue;

    items.push({
      id:          src.id,
      label:       src.label,
      sublabel:    src.sublabel,
      color:       src.color,
      has_range:   src.has_range,
      has_major:   src.has_major,
      has_ace_w60: src.has_ace_w60,
      named_lo:    pred.named_lo,    named_hi:    pred.named_hi,
      hurr_lo:     pred.hurr_lo,     hurr_hi:     pred.hurr_hi,
      major_lo:    pred.major_lo,    major_hi:    pred.major_hi,
      ace_lo:      pred.ace_lo,      ace_hi:      pred.ace_hi,
      ace_w60_lo:  pred.ace_w60_lo,  ace_w60_hi:  pred.ace_w60_hi,
      isActual:    false,
    });
  }

  // Actual column always goes last
  if (actual) {
    items.push({
      id:          'actual',
      label:       String(selectedYear),
      sublabel:    'Actual',
      color:       'rgba(237,234,227,0.85)',
      has_range:   false,
      has_major:   true,
      has_ace_w60: actual.ace_w60 != null,
      named_lo:    actual.named,     named_hi:    actual.named,
      hurr_lo:     actual.hurr,      hurr_hi:     actual.hurr,
      major_lo:    actual.major,     major_hi:    actual.major,
      ace_lo:      actual.ace,       ace_hi:      actual.ace,
      ace_w60_lo:  actual.ace_w60,   ace_w60_hi:  actual.ace_w60,
      isActual:    true,
    });
  }

  return items;
}
