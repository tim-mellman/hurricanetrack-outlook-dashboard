/**
 * outlook.js — outlook.html page logic
 *
 * Shows the historical performance of one forecast source:
 *   - Storm count chart: predicted vs actual, year by year (2 bars + dot per year)
 *   - ACE chart: same structure
 *   - HT Skill Index display
 *
 * URL param: ?src=noaa_may
 *
 * Depends on: data.js, charts.js, skills.js
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params   = new URLSearchParams(window.location.search);
  const sourceId = params.get('src') ?? 'noaa_may';

  const db  = await getData();
  const src = db.getSource(sourceId);

  if (!src) {
    document.getElementById('outlookContent').innerHTML =
      '<p style="color:var(--muted);padding:24px">Unknown source: ' + sourceId + '</p>';
    return;
  }

  renderHeader(src);
  renderCharts(db, src);
  renderSkill(db, src);
});

function renderHeader(src) {
  const el = document.getElementById('outlookHeader');
  if (!el) return;
  el.innerHTML = `
    <div class="page-hero-title">${src.label} <span>${src.sublabel}</span> Outlook</div>
    <div class="page-hero-meta">Historical performance · ${src.start_year}–present</div>
  `;
}

function renderCharts(db, src) {
  // TODO: call makeHistoryChart and makeAceHistoryChart — Step 5
  console.log('renderCharts: to be implemented for', src.id);
}

function renderSkill(db, src) {
  const skill = computeSkill(src.id, db.predictions, db.actuals, db.sources);
  const el    = document.getElementById('skillDisplay');
  if (!el || !skill) return;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px">
      <div class="grade-badge grade-${skill.grade}">${skill.grade}</div>
      <div>
        <div style="font-family:'Norwester',sans-serif;font-size:1.8rem;color:var(--accent)">${skill.index ?? '—'}</div>
        <div class="label">HT Skill Index (0–100) · ${skill.yearCount} years</div>
      </div>
    </div>
  `;
}
