/**
 * skills.js — HT Skill Index calculation
 *
 * All skill math lives here so it's a one-file change to tune the formula.
 *
 * For each category C ∈ {named, hurr, major, ace}:
 *   error_C       = |predicted - actual|
 *   climo_error_C = |climatological_avg - actual|   (baseline: just guess average)
 *   skill_C       = max(0, 1 - error_C / climo_error_C)
 *
 * Bias penalty: if |mean_bias| > 1 std-dev of errors → multiply skill_C × 0.85
 *
 * HT_Skill_Index = weighted average of available skill_C values, scaled 0–100
 * Letter grade:  ≥85 → A,  ≥70 → B,  ≥55 → C,  <55 → D
 */

const CLIMO = { named: 14, hurr: 7, major: 3, ace: 123 };

const SKILL_WEIGHTS = { named: 1, hurr: 1.2, major: 1.2, ace: 1.5 };

/**
 * Compute skill for a single source across all years with both prediction and actual data.
 *
 * @param {string} sourceId
 * @param {Array}  predictions   - full predictions.json array
 * @param {Array}  actuals       - full actuals.json array
 * @param {Object} sourcesMeta   - sources.json array, used to check has_major etc.
 * @returns {{ named, hurr, major, ace, index, grade, yearCount }}
 */
function computeSkill(sourceId, predictions, actuals, sourcesMeta) {
  const src = sourcesMeta.find(s => s.id === sourceId);
  if (!src) return null;

  const categories = ['named', 'hurr', 'ace'];
  if (src.has_major) categories.push('major');

  const errors   = Object.fromEntries(categories.map(c => [c, []]));
  const biases   = Object.fromEntries(categories.map(c => [c, []]));

  for (const pred of predictions) {
    if (pred.source_id !== sourceId) continue;

    const actual = actuals.find(a => a.year === pred.year);
    if (!actual) continue;

    for (const cat of categories) {
      const predVal   = midpoint(pred[`${cat}_lo`], pred[`${cat}_hi`]);
      const actualVal = actual[cat];
      if (predVal === null || actualVal === null) continue;

      errors[cat].push(Math.abs(predVal - actualVal));
      biases[cat].push(predVal - actualVal);           // positive = over-forecast
    }
  }

  const skillPerCat = {};
  for (const cat of categories) {
    if (errors[cat].length === 0) {
      skillPerCat[cat] = null;
      continue;
    }

    const mae       = mean(errors[cat]);
    const climoErr  = Math.abs(CLIMO[cat] - mean(actuals.filter(a => errors[cat].length > 0 && actuals.find(x => x.year === a.year)).map(a => a[cat]).filter(v => v !== null)));
    const rawSkill  = climoErr === 0 ? 0 : Math.max(0, 1 - mae / climoErr);

    // Bias penalty
    const meanBias = mean(biases[cat]);
    const biasPenalty = Math.abs(meanBias) > stddev(errors[cat]) ? 0.85 : 1.0;

    skillPerCat[cat] = rawSkill * biasPenalty;
  }

  const index = weightedAverage(skillPerCat, SKILL_WEIGHTS);
  const yearCount = errors[categories[0]] ? errors[categories[0]].length : 0;

  return {
    ...skillPerCat,
    index: index !== null ? Math.round(index * 100) : null,
    grade: letterGrade(index !== null ? index * 100 : null),
    yearCount,
  };
}

/**
 * Compute skill scores for all sources and return sorted by index descending.
 *
 * @param {Array} predictions
 * @param {Array} actuals
 * @param {Array} sourcesMeta
 * @returns {Array} [{ source_id, label, sublabel, ...skill }, ...]
 */
function computeAllSkills(predictions, actuals, sourcesMeta) {
  return sourcesMeta
    .map(src => ({
      source_id: src.id,
      label:     src.label,
      sublabel:  src.sublabel,
      color:     src.color,
      ...computeSkill(src.id, predictions, actuals, sourcesMeta),
    }))
    .filter(s => s.index !== null)
    .sort((a, b) => b.index - a.index);
}

// ─── helpers ──────────────────────────────────────────────────────────────

function midpoint(lo, hi) {
  if (lo === null || lo === undefined) return null;
  if (hi === null || hi === undefined) return lo;
  return (lo + hi) / 2;
}

function mean(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function stddev(arr) {
  const m = mean(arr);
  if (m === null) return 0;
  const valid = arr.filter(v => v !== null);
  return Math.sqrt(valid.map(v => (v - m) ** 2).reduce((a, b) => a + b, 0) / valid.length);
}

function weightedAverage(obj, weights) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) continue;
    const w = weights[key] ?? 1;
    weightedSum  += val * w;
    totalWeight  += w;
  }
  return totalWeight === 0 ? null : weightedSum / totalWeight;
}

function letterGrade(score) {
  if (score === null) return '—';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}
