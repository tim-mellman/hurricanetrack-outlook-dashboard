/**
 * charts.js — shared Chart.js configuration and rendering helpers
 *
 * All chart instances are created here.  Page scripts call the functions
 * below and hand them a canvas element + data; the chart handles the rest.
 *
 * Chart.js 4.x is loaded via CDN in each HTML file.
 *
 * Exported functions (used by page scripts):
 *   makeOutlookChart(canvas, data, options)   — index.html dot/bar chart
 *   makeHistoryChart(canvas, data, options)    — outlook.html predicted vs actual
 *   makeAceHistoryChart(canvas, data, options) — outlook.html ACE
 *   makeTimelineChart(canvas, storms)          — season.html Gantt timeline
 *   makeAceCurveChart(canvas, data)            — season.html cumulative ACE
 *   makeSkillBarChart(canvas, skills)          — compare.html skill bars
 */

// ─── Shared Chart.js defaults ──────────────────────────────────────────────

const GRID_COLOR = 'rgba(255,255,255,0.05)';
const TICK_COLOR = 'rgba(237,234,227,0.35)';
const TOOLTIP_BG = '#1a1c1f';

const BASE_SCALE_X = {
  ticks: { color: TICK_COLOR, font: { size: 11, family: 'Montserrat' } },
  grid:  { color: GRID_COLOR },
};

const BASE_SCALE_Y = {
  ticks: { color: TICK_COLOR, font: { size: 11 } },
  grid:  { color: GRID_COLOR },
};

const BASE_PLUGIN_OPTS = {
  legend: { display: false },
  tooltip: {
    backgroundColor:  TOOLTIP_BG,
    borderColor:      'rgba(255,255,255,0.12)',
    borderWidth:      1,
    titleColor:       '#fbb03b',
    bodyColor:        'rgba(237,234,227,0.7)',
    padding:          10,
    callbacks: {},
  },
};

function baseChartOptions(yLabel = '') {
  return {
    responsive:          true,
    maintainAspectRatio: false,
    animation:           { duration: 350 },
    plugins:             { ...BASE_PLUGIN_OPTS },
    scales: {
      x: { ...BASE_SCALE_X },
      y: {
        ...BASE_SCALE_Y,
        title: yLabel
          ? { display: true, text: yLabel, color: TICK_COLOR, font: { size: 11 } }
          : { display: false },
      },
    },
  };
}

// ─── Category / metric colors ─────────────────────────────────────────────

const COLOR = {
  named:  '#4e8cca',
  hurr:   '#fbb03b',
  major:  '#db3727',
  ace:    '#a78bfa',
  actual: 'rgba(237,234,227,0.8)',
  climo:  'rgba(255,255,255,0.25)',
};

// Colors for storm category bars on the timeline
const CAT_COLORS = {
  '-1': '#4e8cca',  // tropical storm / sub-hurricane
  0:    '#4e8cca',
  1:    '#4ade80',
  2:    '#facc15',
  3:    '#fbb03b',
  4:    '#db3727',
  5:    '#f472b6',
};

function catColor(cat) {
  return CAT_COLORS[String(cat)] ?? '#888';
}

// ─── Climatological average annotation lines ──────────────────────────────

function climoAnnotations(categories) {
  const avgs = { named: 14, hurr: 7, major: 3, ace: 123, ace_w60: 73 };
  const annotations = {};
  for (const cat of categories) {
    if (avgs[cat] === undefined) continue;
    annotations[`climo_${cat}`] = {
      type:        'line',
      yMin:        avgs[cat],
      yMax:        avgs[cat],
      borderColor: COLOR[cat] ?? 'rgba(255,255,255,0.3)',
      borderWidth: 1,
      borderDash:  [5, 4],
    };
  }
  return annotations;
}

// ─── Placeholder functions — implemented as pages are built ───────────────

/**
 * Main dashboard outlook chart.
 *
 * mode 'storms' → named / hurricanes / major columns
 * mode 'ace'    → ACE / ACE-west-of-60°W columns
 *
 * items[] comes from dashboard.js buildItems():
 *   { id, label, sublabel, color, has_range, has_major, has_ace_w60,
 *     named_lo, named_hi, hurr_lo, hurr_hi, major_lo, major_hi,
 *     ace_lo, ace_hi, ace_w60_lo, ace_w60_hi, isActual }
 *
 * Point-estimate sources have lo === hi.
 * Range sources have lo !== hi — drawn as a capped vertical bar by the plugin.
 * The actual column uses diamond (rectRot) markers and sits after a separator line.
 */
function makeOutlookChart(canvas, { items, mode }) {
  if (!canvas || !items.length) return null;

  const isStorms = mode === 'storms';
  const mid = (lo, hi) => lo == null ? null : hi == null ? lo : (lo + hi) / 2;

  // ── Per-mode metric config ─────────────────────────────────────────────────
  const METRICS = isStorms
    ? [
        { key: 'named', color: COLOR.named, label: 'Named'      },
        { key: 'hurr',  color: COLOR.hurr,  label: 'Hurricanes' },
        { key: 'major', color: COLOR.major, label: 'Major'      },
      ]
    : [
        { key: 'ace',     color: COLOR.ace,                label: 'ACE'           },
        { key: 'ace_w60', color: 'rgba(167,139,250,0.65)', label: 'ACE west 60°W' },
      ];

  const CLIMO_LINES = isStorms
    ? [
        { y: 14, color: COLOR.named },
        { y: 7,  color: COLOR.hurr  },
        { y: 3,  color: COLOR.major },
      ]
    : [
        { y: 123, color: COLOR.ace                   },
        { y: 73,  color: 'rgba(167,139,250,0.65)'    },
      ];

  // ── Build scatter datasets ─────────────────────────────────────────────────
  // One pair per metric: predictions (circles) + actual (diamonds).
  const datasets = [];

  for (const m of METRICS) {
    const predPts = [], actualPts = [];

    items.forEach((item, i) => {
      const lo = item[m.key + '_lo'];
      const hi = item[m.key + '_hi'];
      const v  = mid(lo, hi);
      if (v == null) return;

      if (item.isActual) {
        actualPts.push({ x: i, y: v });
      } else if (!item.has_range || lo === hi) {
        predPts.push({ x: i, y: v });
      } else {
        // Range source: invisible midpoint so Chart.js can detect hover and show tooltip
        predPts.push({ x: i, y: v, lo, hi });
      }
    });

    const isW60 = m.key === 'ace_w60';
    const isRangePt = pt => 'lo' in pt;

    if (predPts.length) {
      datasets.push({
        label:            m.label,
        data:             predPts,
        backgroundColor:  predPts.map(pt => isRangePt(pt) ? 'transparent' : (isW60 ? 'transparent' : m.color)),
        borderColor:      predPts.map(pt => isRangePt(pt) ? 'transparent' : m.color),
        borderWidth:      predPts.map(pt => isRangePt(pt) ? 0 : (isW60 ? 2 : 0)),
        pointStyle:       'circle',
        pointRadius:      predPts.map(pt => isRangePt(pt) ? 0 : (isW60 ? 5 : 7)),
        pointHoverRadius: predPts.map(pt => isRangePt(pt) ? 14 : (isW60 ? 7 : 9)),
        showLine:         false,
      });
    }

    if (actualPts.length) {
      // Solid fill + white border makes actuals stand out clearly
      datasets.push({
        label:            m.label + ' (actual)',
        data:             actualPts,
        backgroundColor:  m.color,
        borderColor:      'rgba(237,234,227,0.9)',
        borderWidth:      2,
        pointStyle:       'rectRot',
        pointRadius:      10,
        pointHoverRadius: 12,
        showLine:         false,
      });
    }
  }

  // ── Custom plugin ──────────────────────────────────────────────────────────
  const customPlugin = {
    id: 'outlookDraw_' + mode,

    beforeDatasetsDraw(chart) {
      const { ctx, scales: { x: xs, y: ys }, chartArea: ca } = chart;

      // Highlight the actual column with a subtle bright band
      const aIdx = items.findIndex(it => it.isActual);
      if (aIdx >= 0) {
        const halfCol = items.length > 1
          ? Math.abs(xs.getPixelForValue(1) - xs.getPixelForValue(0)) / 2
          : 40;
        const px = xs.getPixelForValue(aIdx);
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(px - halfCol, ca.top, halfCol * 2, ca.bottom - ca.top);
        ctx.restore();
      }

      if (!isStorms) {
        // ACE activity shading: red above 150, blue below 75
        for (const [lo, hi, fill] of [
          [150, Infinity, 'rgba(219,55,39,0.06)'],
          [0,   75,       'rgba(78,140,202,0.06)'],
        ]) {
          const top    = ys.getPixelForValue(Math.min(hi, ys.max));
          const bottom = ys.getPixelForValue(Math.max(lo, ys.min));
          if (top >= bottom) continue;
          ctx.save();
          ctx.fillStyle = fill;
          ctx.fillRect(ca.left, top, ca.right - ca.left, bottom - top);
          ctx.restore();
        }
      }
    },

    afterDatasetsDraw(chart) {
      // Each metric's range bar is drawn at the column's x center (same as its dot),
      // so bars and dots are vertically aligned per metric. The three metrics occupy
      // different y-ranges so they don't overlap.
      const { ctx, scales: { x: xs, y: ys } } = chart;
      const colPx = items.length > 1 ? Math.abs(xs.getPixelForValue(1) - xs.getPixelForValue(0)) : 80;
      const barW  = Math.max(10, Math.round(colPx * 0.35));

      items.forEach((item, i) => {
        if (item.isActual || !item.has_range) return;

        const xCenter = Math.round(xs.getPixelForValue(i));
        const x       = xCenter - Math.floor(barW / 2);  // integer left edge

        METRICS.forEach(({ key, color }) => {
          const lo = item[key + '_lo'];
          const hi = item[key + '_hi'];
          if (lo == null || hi == null || lo === hi) return;

          const pLo = Math.round(ys.getPixelForValue(lo));
          const pHi = Math.round(ys.getPixelForValue(hi));

          ctx.save();
          ctx.fillStyle   = color;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x, pHi, barW, pLo - pHi);
          ctx.globalAlpha = 0.9;
          ctx.fillRect(x, pHi, barW, 3);      // hi cap
          ctx.fillRect(x, pLo - 3, barW, 3);  // lo cap
          ctx.restore();
        });
      });
    },

    afterDraw(chart) {
      const { ctx, scales: { x: xs, y: ys }, chartArea: ca } = chart;

      // Climatology dashed reference lines
      for (const { y, color } of CLIMO_LINES) {
        const py = ys.getPixelForValue(y);
        if (py < ca.top || py > ca.bottom) continue;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth   = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(ca.left, py);
        ctx.lineTo(ca.right, py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Subtle dashed separator before the actual column
      const aIdx = items.findIndex(it => it.isActual);
      if (aIdx > 0) {
        const px = (xs.getPixelForValue(aIdx - 1) + xs.getPixelForValue(aIdx)) / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(px, ca.top);
        ctx.lineTo(px, ca.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Short colored tick-mark line below each column — gives color identity
      // without duplicating the text already shown in the chip row below.
      const colPxM  = items.length > 1 ? Math.abs(xs.getPixelForValue(1) - xs.getPixelForValue(0)) : 80;
      const markerW = Math.max(8, Math.round(colPxM * 0.55));
      items.forEach((item, i) => {
        const xc = Math.round(xs.getPixelForValue(i));
        ctx.save();
        ctx.fillStyle   = item.isActual ? 'rgba(237,234,227,0.4)' : item.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(xc - Math.floor(markerW / 2), ca.bottom + 5, markerW, 3);
        ctx.restore();
      });
    },
  };

  // ── Y-axis ceiling ─────────────────────────────────────────────────────────
  const vals = items.flatMap(it =>
    METRICS.flatMap(({ key }) => [it[key + '_lo'], it[key + '_hi']]).filter(v => v != null)
  );
  const step   = isStorms ? 5 : 25;
  const climoY = isStorms ? 14 : 123;
  const yMax   = Math.ceil(Math.max(vals.length ? Math.max(...vals) : climoY, climoY) * 1.2 / step) * step;

  // ── Chart config ───────────────────────────────────────────────────────────
  return new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 200 },
      interaction:         { mode: 'nearest', intersect: false },
      layout:              { padding: { bottom: 12 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: TOOLTIP_BG,
          borderColor:     'rgba(255,255,255,0.12)',
          borderWidth:     1,
          titleColor:      '#fbb03b',
          bodyColor:       'rgba(237,234,227,0.7)',
          padding:         10,
          callbacks: {
            title(ctxArr) {
              const item = items[Math.round(ctxArr[0].raw.x)];
              return item ? `${item.label} ${item.sublabel}` : '';
            },
            label(ctx) {
              const pt  = ctx.raw;
              const fmt = v => Number.isInteger(v) ? v : +v.toFixed(1);
              if ('lo' in pt && pt.lo !== pt.hi) {
                return `  ${ctx.dataset.label}: ${fmt(pt.lo)}–${fmt(pt.hi)}`;
              }
              return `  ${ctx.dataset.label}: ${fmt(pt.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          type:  'linear',
          min:   -0.5,
          max:   items.length - 0.5,
          grid:  { color: GRID_COLOR },
          ticks: {
            display:  false, // drawn manually in afterDraw for reliable per-column colors
            stepSize: 1,
          },
        },
        y: {
          ...BASE_SCALE_Y,
          min:   0,
          max:   yMax,
          ticks: { ...BASE_SCALE_Y.ticks, stepSize: step },
        },
      },
      onClick(e, elems, chart) {
        if (!elems.length) return;
        const { datasetIndex, index } = elems[0];
        const { x } = chart.data.datasets[datasetIndex].data[index];
        const item  = items[Math.round(x)];
        if (item && !item.isActual) window.location.href = `outlook.html?src=${item.id}`;
      },
    },
    plugins: [customPlugin],
  });
}

/**
 * Outlook detail page: historical predicted vs actual bar+line chart.
 */
function makeHistoryChart(canvas, { sourceId, predictions, actuals, category }) {
  // TODO: implement in outlook.js step
  console.log('makeHistoryChart: to be implemented');
}

/**
 * Outlook detail page: historical ACE predicted vs actual.
 */
function makeAceHistoryChart(canvas, { sourceId, predictions, actuals }) {
  // TODO: implement in outlook.js step
  console.log('makeAceHistoryChart: to be implemented');
}

/**
 * Season page: Gantt-style storm timeline.
 * Each storm = a horizontal bar colored by peak category.
 */
function makeTimelineChart(canvas, storms) {
  // TODO: implement in season.js step
  console.log('makeTimelineChart: to be implemented');
}

/**
 * Season page: cumulative ACE curve vs historical average.
 */
function makeAceCurveChart(canvas, { currentYear, aceDaily }) {
  // TODO: implement in season.js step
  console.log('makeAceCurveChart: to be implemented');
}

/**
 * Compare page: horizontal bar chart of skill sub-scores by source.
 */
function makeSkillBarChart(canvas, skills) {
  // TODO: implement in compare.js step
  console.log('makeSkillBarChart: to be implemented');
}

// Utility: destroy a chart instance if it already exists
function destroyChart(instance) {
  if (instance) instance.destroy();
  return null;
}
