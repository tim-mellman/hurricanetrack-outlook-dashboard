/**
 * season.js — season.html page logic
 *
 * For a selected year (default: current year), renders:
 *   - Summary cards: named, hurr, major, ACE, ACE west of 60°W
 *   - Storm timeline: Gantt chart one bar per storm, colored by peak category
 *   - Cumulative ACE curve vs historical average + ±1 std dev band
 *   - Smoothed ACE density curve
 *
 * URL param: ?year=2026  (defaults to current year)
 *
 * Depends on: data.js, charts.js
 */

let selectedYear = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  selectedYear = parseInt(params.get('year')) || new Date().getFullYear();

  const db = await getData();
  renderSummaryCards(db);
  renderTimeline(db);
  renderAceCurve(db);
});

function renderSummaryCards(db) {
  const actual = db.getActual(selectedYear);
  const el     = document.getElementById('summaryCards');
  if (!el) return;

  const metrics = [
    { key: 'named', label: 'Named Storms', color: 'var(--named)' },
    { key: 'hurr',  label: 'Hurricanes',   color: 'var(--hurr)'  },
    { key: 'major', label: 'Major Hurr.',  color: 'var(--major)' },
    { key: 'ace',   label: 'ACE',          color: 'var(--ace)'   },
    { key: 'ace_w60', label: 'ACE W 60°W', color: 'var(--ace)'   },
  ];

  el.innerHTML = metrics.map(m => `
    <div class="summary-card">
      <div class="summary-card-label" style="color:${m.color}">${m.label}</div>
      <div class="summary-card-value" style="color:${m.color}">
        ${actual?.[m.key] ?? '—'}
      </div>
    </div>
  `).join('');
}

function renderTimeline(db) {
  const canvas = document.getElementById('timelineChart');
  if (!canvas) return;
  const storms = db.getStorms(selectedYear);
  makeTimelineChart(canvas, storms);
}

function renderAceCurve(db) {
  const canvas = document.getElementById('aceCurveChart');
  if (!canvas) return;
  makeAceCurveChart(canvas, { currentYear: selectedYear, aceDaily: db.aceDaily });
}
