/**
 * compare.js — compare.html page logic
 *
 * Shows all forecast sources ranked by HT Skill Index.
 * Also provides a head-to-head bar chart of skill sub-scores.
 *
 * Depends on: data.js, charts.js, skills.js
 */

document.addEventListener('DOMContentLoaded', async () => {
  const db     = await getData();
  const skills = computeAllSkills(db.predictions, db.actuals, db.sources);

  renderRankTable(skills);
  renderSkillChart(skills, db);
});

function renderRankTable(skills) {
  const el = document.getElementById('rankTable');
  if (!el) return;

  const rows = skills.map((s, i) => `
    <tr>
      <td style="color:var(--muted);font-size:0.9rem">${i + 1}</td>
      <td>
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};margin-right:6px"></span>
        <strong>${s.label}</strong> <span style="color:var(--muted);font-size:0.85em">${s.sublabel}</span>
      </td>
      <td>
        <span class="grade-badge grade-${s.grade}">${s.grade}</span>
      </td>
      <td style="font-family:'Courier New',monospace">${s.index ?? '—'}</td>
      <td style="font-family:'Courier New',monospace;color:var(--named)">${fmtSkill(s.named)}</td>
      <td style="font-family:'Courier New',monospace;color:var(--hurr)">${fmtSkill(s.hurr)}</td>
      <td style="font-family:'Courier New',monospace;color:var(--major)">${fmtSkill(s.major)}</td>
      <td style="font-family:'Courier New',monospace;color:var(--ace)">${fmtSkill(s.ace)}</td>
      <td style="color:var(--muted);font-size:0.82rem">${s.yearCount}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>#</th><th>Source</th><th>Grade</th><th>Index</th>
          <th>Named</th><th>Hurr</th><th>Major</th><th>ACE</th><th>Years</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSkillChart(skills, db) {
  const canvas = document.getElementById('skillChart');
  if (!canvas) return;
  makeSkillBarChart(canvas, skills);
}

function fmtSkill(v) {
  if (v === null || v === undefined) return '—';
  return (v * 100).toFixed(0);
}
