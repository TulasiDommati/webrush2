/* Pure helpers — no DOM, so they can be unit-tested in Node. */
export const EPOCH = Date.UTC(2013, 0, 1);
export const DAY = 864e5;
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const fmtH = h => h === 0 ? "12 am" : h === 12 ? "12 pm" : h < 12 ? h + " am" : h - 12 + " pm";
export const dateOf = i => new Date(EPOCH + i * DAY);
export const dayOf = s => Math.round((Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) - EPOCH) / DAY);
export const fmtD = i => { const d = dateOf(i); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const fmtM = i => { const d = dateOf(i); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const yearOf = i => dateOf(i).getUTCFullYear();
export const monthKey = i => { const d = dateOf(i); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export const num = n => Math.round(n).toLocaleString("en-IN");
export const inr = n => "₹" + num(n);
export const pct = x => Math.round(x * 100) + "%";
/* Escape untrusted strings before they go into innerHTML. */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
