/**
 * data.js — central data loader
 *
 * Fetches all five JSON files once and caches them.  Every page imports this
 * file and calls getData() to get a single object with everything.
 *
 * Usage:
 *   getData().then(({ sources, predictions, actuals, storms, aceDaily }) => { ... });
 *
 * Helper functions are attached to the returned object so pages never
 * have to write their own array-filter loops for common lookups.
 */

let _cache = null;

async function getData() {
  if (_cache) return _cache;

  const base = './data/';
  const [sources, predictions, actuals, storms, aceDaily] = await Promise.all([
    fetchJSON(base + 'sources.json'),
    fetchJSON(base + 'predictions.json'),
    fetchJSON(base + 'actuals.json'),
    fetchJSON(base + 'storms.json'),
    fetchJSON(base + 'ace_daily.json'),
  ]);

  // Strip the _note sentinel that lives in predictions.json
  const cleanPredictions = predictions.filter(p => !p._note);

  _cache = {
    sources,
    predictions: cleanPredictions,
    actuals,
    storms,
    aceDaily,

    // ── Lookup helpers ──────────────────────────────────────────────────

    /** Return the source metadata object for a given id. */
    getSource(id) {
      return sources.find(s => s.id === id) ?? null;
    },

    /** Return the prediction record for (sourceId, year), or null. */
    getPrediction(sourceId, year) {
      return cleanPredictions.find(p => p.source_id === sourceId && p.year === year) ?? null;
    },

    /** Return the actuals record for a year, or null. */
    getActual(year) {
      return actuals.find(a => a.year === year) ?? null;
    },

    /** Return all storms for a given year, sorted by start date. */
    getStorms(year) {
      return storms
        .filter(s => s.year === year)
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    },

    /** Return the ace_daily data for a year, or null. */
    getAceDaily(year) {
      return aceDaily.find(d => d.year === year) ?? null;
    },

    /**
     * Return all predictions for a source across all years
     * (only those with at least one non-null value).
     */
    getPredictionsForSource(sourceId) {
      return cleanPredictions.filter(
        p => p.source_id === sourceId && hasAnyValue(p)
      );
    },

    /**
     * Return all predictions for a year across all sources,
     * ordered by sources array (which is chronological).
     */
    getPredictionsForYear(year) {
      return sources
        .map(s => cleanPredictions.find(p => p.source_id === s.id && p.year === year))
        .filter(Boolean);
    },

    /** Midpoint helper: (lo + hi) / 2, or null if either is null. */
    midpoint(lo, hi) {
      if (lo === null || lo === undefined) return null;
      if (hi === null || hi === undefined) return lo;
      return (lo + hi) / 2;
    },
  };

  return _cache;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

function hasAnyValue(pred) {
  const keys = ['named_lo', 'hurr_lo', 'major_lo', 'ace_lo'];
  return keys.some(k => pred[k] !== null && pred[k] !== undefined);
}
