// Small display helpers (timestamps arrive from the API as ISO-8601 UTC strings).
const parse = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d; };
export function formatDate(iso) { const d = parse(iso); return d ? d.toLocaleDateString() : '—'; }
export function formatDateTime(iso) { const d = parse(iso); return d ? d.toLocaleString() : '—'; }
// "daysBeforeExpiry" -> "Days before expiry"
export function humanizeKey(key) {
  const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
export function describeConditions(conditions) {
  const entries = Object.entries(conditions || {});
  return entries.length ? entries.map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(', ') : 'No extra conditions';
}
