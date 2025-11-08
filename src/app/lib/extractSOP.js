function extractSOPsFromText(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const keywords = ["sop", "procedure", "steps", "purpose", "scope", "responsibilities", "responsibility", "standard operating procedure"];
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    for (const kw of keywords) {
      if (low.includes(kw)) {
        // capture a small block around the keyword line
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length - 1, i + 4);
        const block = lines.slice(start, end + 1).join('\n');
        results.push({
          title: lines[i].length <= 100 ? lines[i] : lines[i].slice(0, 100),
          content: block,
        });
        break; // move to next line after matching keyword
      }
    }
  }

  // De-duplicate similar blocks
  const uniq = [];
  const seen = new Set();
  for (const r of results) {
    const key = r.content.slice(0, 200);
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(r);
    }
  }
  return uniq;
}

module.exports = { extractSOPsFromText };