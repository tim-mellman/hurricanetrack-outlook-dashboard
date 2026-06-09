/**
 * admin.js — admin.html page logic
 *
 * Password-protected data entry panel.  Saves to localStorage in the
 * standalone dev version.  To switch to server-side persistence when
 * merged into HurricaneTrack, replace the two localStorage calls below
 * with a single fetch('/api/save.php', { method:'POST', body: ... }).
 *
 * Sections:
 *   1. Current season actuals (named, hurr, major, ACE, ACE w60)
 *   2. Outlook predictions — one sub-tab per source
 *   3. Historical actuals grid
 *   4. Storm records (add/edit individual storms)
 *
 * Password: hurricanetrack2025 (user can change in admin UI)
 *
 * Depends on: data.js
 */

const ADMIN_PW_KEY    = 'ht_admin_pw';
const ADMIN_DATA_KEY  = 'ht_admin_data';
const DEFAULT_PW      = 'hurricanetrack2025';

let adminUnlocked = false;
let db = null;

document.addEventListener('DOMContentLoaded', async () => {
  db = await getData();
  renderLockScreen();
});

// ─── Lock / Unlock ────────────────────────────────────────────────────────

function renderLockScreen() {
  const lock = document.getElementById('adminLock');
  if (lock) lock.style.display = 'block';
  const form = document.getElementById('adminForm');
  if (form) form.style.display = 'none';
}

function tryUnlock() {
  const input   = document.getElementById('adminPwInput');
  const errEl   = document.getElementById('adminErr');
  const pw      = input?.value ?? '';
  const correct = localStorage.getItem(ADMIN_PW_KEY) ?? DEFAULT_PW;

  if (pw === correct) {
    adminUnlocked = true;
    document.getElementById('adminLock').style.display = 'none';
    document.getElementById('adminForm').style.display = 'block';
    renderAdminForm();
  } else {
    if (errEl) errEl.textContent = 'Incorrect password.';
  }
}

function lockAdmin() {
  adminUnlocked = false;
  renderLockScreen();
}

// ─── Form rendering ───────────────────────────────────────────────────────

function renderAdminForm() {
  renderActualsSection();
  renderPredictionsSection();
  renderHistoricalSection();
  renderStormsSection();
}

function renderActualsSection() {
  const el = document.getElementById('actualsFields');
  if (!el) return;

  const currentYear = new Date().getFullYear();
  const actual      = db.getActual(currentYear) ?? {};

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
      ${['named','hurr','major','ace','ace_w60'].map(k => `
        <div class="field-group">
          <div class="field-label">${k.replace('_', ' ')}</div>
          <input class="field-input" id="act_${k}" type="number" min="0"
                 value="${actual[k] ?? ''}" placeholder="—">
        </div>
      `).join('')}
    </div>
  `;
}

function renderPredictionsSection() {
  const tabs = document.getElementById('predTabs');
  const body = document.getElementById('predFields');
  if (!tabs || !body) return;

  const currentYear = new Date().getFullYear();

  // Build source tabs
  tabs.innerHTML = db.sources.map((s, i) => `
    <button class="btn btn-ghost ${i === 0 ? 'active' : ''}"
            onclick="switchPredTab('${s.id}', this)">
      ${s.label} ${s.sublabel}
    </button>
  `).join('');

  switchPredTab(db.sources[0].id, tabs.firstElementChild);
}

function switchPredTab(sourceId, btn) {
  document.querySelectorAll('#predTabs .btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const body        = document.getElementById('predFields');
  const src         = db.getSource(sourceId);
  const currentYear = new Date().getFullYear();
  const pred        = db.getPrediction(sourceId, currentYear) ?? {};

  const fields = src.has_range
    ? [
        { key: 'named_lo', label: 'Named Lo' }, { key: 'named_hi', label: 'Named Hi' },
        { key: 'hurr_lo',  label: 'Hurr Lo'  }, { key: 'hurr_hi',  label: 'Hurr Hi'  },
        ...(src.has_major ? [{ key: 'major_lo', label: 'Major Lo' }, { key: 'major_hi', label: 'Major Hi' }] : []),
        { key: 'ace_lo',   label: 'ACE Lo'   }, { key: 'ace_hi',   label: 'ACE Hi'   },
        ...(src.has_ace_w60 ? [{ key: 'ace_w60_lo', label: 'ACE W60 Lo' }, { key: 'ace_w60_hi', label: 'ACE W60 Hi' }] : []),
      ]
    : [
        { key: 'named_lo', label: 'Named' },
        { key: 'hurr_lo',  label: 'Hurr'  },
        ...(src.has_major ? [{ key: 'major_lo', label: 'Major' }] : []),
        { key: 'ace_lo',   label: 'ACE'   },
        ...(src.has_ace_w60 ? [{ key: 'ace_w60_lo', label: 'ACE W60' }] : []),
      ];

  body.innerHTML = `
    <div data-src="${sourceId}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">
      ${fields.map(f => `
        <div class="field-group">
          <div class="field-label">${f.label}</div>
          <input class="field-input pred-input" data-src="${sourceId}" data-key="${f.key}"
                 type="number" min="0" value="${pred[f.key] ?? ''}" placeholder="—">
        </div>
      `).join('')}
    </div>
  `;
}

function renderHistoricalSection() {
  const el = document.getElementById('historicalFields');
  if (!el) return;

  const years = db.actuals.map(a => a.year).sort((a, b) => b - a);

  el.innerHTML = `
    <table class="data-table" style="font-size:0.78rem">
      <thead>
        <tr><th>Year</th><th>Named</th><th>Hurr</th><th>Major</th><th>ACE</th><th>ACE W60</th></tr>
      </thead>
      <tbody>
        ${years.map(y => {
          const a = db.getActual(y) ?? {};
          return `<tr>
            <td style="color:var(--accent);font-weight:700">${y}</td>
            ${['named','hurr','major','ace','ace_w60'].map(k =>
              `<td><input class="field-input hist-input" data-year="${y}" data-key="${k}"
                    type="number" min="0" value="${a[k] ?? ''}" placeholder="—"
                    style="width:70px;padding:4px 6px;font-size:0.78rem"></td>`
            ).join('')}
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderStormsSection() {
  // Storm table — simplified placeholder; full CRUD coming in a later step
  const el = document.getElementById('stormsFields');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:0.82rem">Storm entry form — coming in Step 4 (season page)</div>';
}

// ─── Save ─────────────────────────────────────────────────────────────────

function saveAdmin() {
  const overrides = collectFormData();

  // ── SWAP POINT: replace these two lines with a fetch() POST when going live ──
  localStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(overrides));
  // fetch('/api/save.php', { method: 'POST', body: JSON.stringify(overrides), headers: { 'Content-Type': 'application/json' } });
  // ─────────────────────────────────────────────────────────────────────────────

  showStatus('Saved');
}

function collectFormData() {
  const data = { actuals: {}, predictions: {}, storms: [] };

  // Actuals
  const currentYear = new Date().getFullYear();
  data.actuals[currentYear] = {};
  ['named','hurr','major','ace','ace_w60'].forEach(k => {
    const el = document.getElementById(`act_${k}`);
    if (el && el.value !== '') data.actuals[currentYear][k] = parseFloat(el.value);
  });

  // Predictions
  document.querySelectorAll('.pred-input').forEach(el => {
    const src = el.dataset.src;
    const key = el.dataset.key;
    if (!data.predictions[src]) data.predictions[src] = {};
    if (el.value !== '') data.predictions[src][key] = parseFloat(el.value);
  });

  // Historical actuals
  document.querySelectorAll('.hist-input').forEach(el => {
    const year = parseInt(el.dataset.year);
    const key  = el.dataset.key;
    if (!data.actuals[year]) data.actuals[year] = {};
    if (el.value !== '') data.actuals[year][key] = parseFloat(el.value);
  });

  return data;
}

function showStatus(msg) {
  const el = document.getElementById('adminStatus');
  if (!el) return;
  el.textContent = '✓ ' + msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function resetAdmin() {
  if (!confirm('Reset all admin overrides? This cannot be undone.')) return;
  localStorage.removeItem(ADMIN_DATA_KEY);
  showStatus('Reset complete');
  renderAdminForm();
}
