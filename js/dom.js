// Small DOM helpers shared by the page modules.

export const $ = id => document.getElementById(id);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c != null) node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

// Wrap each target form in the phrase with <mark>, matching the validator's rule
// (whole word, case-insensitive, accents significant).
export function highlight(pt, forms) {
  const unique = [...new Set(forms)].filter(f => typeof f === 'string' && f)
    .sort((a, b) => b.length - a.length)
    .map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!unique.length) return [pt];
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(${unique.join('|')})(?![\\p{L}\\p{M}])`, 'giu');
  const out = [];
  let last = 0;
  for (const m of pt.matchAll(re)) {
    out.push(pt.slice(last, m.index), el('mark', {}, m[0]));
    last = m.index + m[0].length;
  }
  out.push(pt.slice(last));
  return out;
}
