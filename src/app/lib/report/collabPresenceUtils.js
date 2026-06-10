/**
 * Stable signature for collaborator lists — avoid UI flicker when nothing changed.
 * @param {object[]|null|undefined} list
 */
export function participantsSignature(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list
    .map((p) => {
      const id = String(p.userId || p.email || p.clientId || "").trim().toLowerCase();
      const loc = String(p.location || "preview");
      const name = String(p.name || "").trim();
      return `${id}:${loc}:${name}`;
    })
    .sort()
    .join("|");
}

/**
 * @param {object[]|null|undefined} a
 * @param {object[]|null|undefined} b
 */
export function participantsEqual(a, b) {
  return participantsSignature(a) === participantsSignature(b);
}
