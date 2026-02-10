function splitCode(value) {
  const s = String(value ?? "").trim();
  if (!s) return [];

  // Split on dots, hyphens, underscores and whitespace
  const raw = s.split(/[.\-_\s]+/g).filter(Boolean);

  return raw.map((part) => {
    // If purely numeric -> number
    if (/^\d+$/.test(part)) return Number(part);
    // If alphanumeric like "A2" -> ["A", 2]
    const m = part.match(/^([A-Za-z]+)(\d+)$/);
    if (m) return [m[1].toLowerCase(), Number(m[2])];
    return part.toLowerCase();
  }).flat();
}

export function compareCode(a, b) {
  const aa = splitCode(a);
  const bb = splitCode(b);

  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) {
    const x = aa[i];
    const y = bb[i];
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return -1;
    if (y === undefined) return 1;

    const tx = typeof x;
    const ty = typeof y;
    if (tx === "number" && ty === "number") {
      if (x !== y) return x < y ? -1 : 1;
      continue;
    }
    if (tx === "number" && ty !== "number") return -1;
    if (tx !== "number" && ty === "number") return 1;

    const sx = String(x);
    const sy = String(y);
    if (sx !== sy) return sx < sy ? -1 : 1;
  }
  return 0;
}


