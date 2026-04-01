/**
 * Hierarki AUDIT AREA untuk worksheet (multi-checkbox).
 * Label mengikuti screenshot user (uppercase).
 */

/** Disimpan di DB dan ditampilkan di UI/report bila semua leaf area terpilih (bukan daftar panjang). */
export const WORKSHEET_AUDIT_AREA_ALL_LABEL = "All area";

export const WORKSHEET_AUDIT_AREA_TREE = [
  {
    label: "INDONESIA",
    children: [
      {
        label: "BALI",
        children: [
          {
            label: "BALI GALLERIA",
            children: [
              { label: "BALI MBG BOOKS" },
              { label: "BALI OFFICE STORE" },
              { label: "BALI GALLERIA WAREHOUSE" },
            ],
          },
          {
            label: "BALI AIRPORT",
            children: [
              {
                label: "BALI AIRPORT DOMESTIC",
                children: [
                  { label: "BALI DOM AIR CTN" },
                  { label: "BALI DOM GATE CTN" },
                  { label: "BALI DOM AIR BOOKS" },
                  { label: "BALI DOM GATE 2 CTN" },
                  { label: "BALI DOM GATE 5 CTN" },
                  { label: "BALI DOM ARRIVAL CTN" },
                  { label: "BALI DOM AIR TTG" },
                  { label: "POPUP STORE" },
                  { label: "BALI DOM WAREHOUSE" },
                ],
              },
              {
                label: "BALI AIRPORT INTERNATIONAL",
                children: [
                  { label: "BALI INT AIR BOOKS" },
                  { label: "BALI INT ARRIVAL CTN" },
                  { label: "BALI INT GATE 3 TTG" },
                  { label: "BALI INT AIR GS" },
                  { label: "BALI INT LAND G&G" },
                  { label: "BALI INT LAND TTG" },
                  { label: "BALI INT LAND BAY CTN" },
                  { label: "BALI INT GATE 6A TTG" },
                  { label: "BALI INT ARRIVAL SPIRIT" },
                  { label: "BALI INT ARRIVAL CAFE" },
                  { label: "BALI INT LAND CTN" },
                  { label: "BALI INT AIR CTN" },
                  { label: "BALI INT GATE 1 CTN" },
                  { label: "BALI INT GATE 6" },
                  { label: "BALI INT GATE 8 TTG" },
                  { label: "BALI INT GATE 5 CTN" },
                  { label: "BALI INTL WAREHOUSE" },
                  { label: "BALI MAIN WAREHOUSE" },
                  { label: "BALI TEMPORARY TRANSIT" },
                  { label: "BALI OFFICE" },
                  { label: "BALI OFFICE 2" },
                ],
              },
            ],
          },
        ],
      },
      {
        label: "JAKARTA",
        children: [
          {
            label: "JAKARTA AIRPORT",
            children: [
              {
                label: "JAKARTA AIRPORT DOMESTIC",
                children: [{ label: "JKT T3 DOM AIR BOOKS" }],
              },
              {
                label: "JAKARTA AIRPORT INTERNATIONAL",
                children: [
                  { label: "JKT T2 INT AIR CTN" },
                  { label: "JKT T3 INT LAND BOOKS" },
                  { label: "JKT T3 INT AIR BOOKS" },
                  { label: "JKT T3 INT AIR CTN" },
                  { label: "JKT T2 INT TRAVEL TO GO" },
                  { label: "JKT T3 INT GATE 3 CTN" },
                ],
              },
            ],
          },
        ],
      },
      {
        label: "SULAWESI SELATAN",
        children: [
          {
            label: "MAKASSAR AIRPORT",
            children: [{ label: "MAK AIR TRAVEL TO GO" }],
          },
        ],
      },
      {
        label: "BATAM",
        children: [
          { label: "BATAM AIRPORT" },
          {
            label: "BATAM AIRPORT DOMESTIK",
            children: [
              { label: "BTM DOM AIR CTN" },
              { label: "BTM DOM AIR TTG BRANDED" },
            ],
          },
          { label: "BATAM WAREHOUSE" },
          { label: "BATAM OFFICE" },
        ],
      },
      {
        label: "MEDAN",
        children: [
          { label: "MEDAN AIRPORT" },
          {
            label: "MEDAN AIRPORT DOMESTIC",
            children: [
              { label: "MDN DOM AIR CTN" },
              { label: "MDN LAND TTG" },
              { label: "MDN POPUP STORE" },
            ],
          },
          { label: "MEDAN OFFICE" },
          { label: "MEDAN WAREHOUSE" },
        ],
      },
      { label: "HEAD OFFICE" },
    ],
  },
];

/**
 * @param {typeof WORKSHEET_AUDIT_AREA_TREE} nodes
 * @param {string} parentPath
 * @returns {{ path: string, label: string, depth: number }[]}
 */
export function flattenAuditAreaTree(nodes, parentPath = "") {
  const rows = [];
  nodes.forEach((node, index) => {
    const path = parentPath === "" ? String(index) : `${parentPath}-${index}`;
    const depth = path.split("-").length - 1;
    rows.push({ path, label: node.label, depth });
    if (node.children?.length) {
      rows.push(...flattenAuditAreaTree(node.children, path));
    }
  });
  return rows;
}

let _sortedAllAuditLabels;
function getSortedAllAuditLabels() {
  if (!_sortedAllAuditLabels) {
    const rows = flattenAuditAreaTree(WORKSHEET_AUDIT_AREA_TREE);
    _sortedAllAuditLabels = rows.map((r) => r.label).sort((a, b) => a.localeCompare(b));
  }
  return _sortedAllAuditLabels;
}

/** Tampilan singkat di report: "All area" jika nilai tersimpan adalah token khusus atau daftar lengkap semua leaf (legacy). */
export function displayWorksheetAuditArea(storedValue) {
  const s = String(storedValue ?? "").trim();
  if (!s) return "-";
  if (s === WORKSHEET_AUDIT_AREA_ALL_LABEL) return WORKSHEET_AUDIT_AREA_ALL_LABEL;
  const all = getSortedAllAuditLabels();
  const parts = s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  if (parts.length === all.length && parts.every((p, i) => p === all[i])) return WORKSHEET_AUDIT_AREA_ALL_LABEL;
  return s;
}

/** @typedef {{ id: string, label: string }} WorksheetCustomAuditEntry */

/**
 * Parse `custom_audit_areas` column (JSON) from API/DB.
 * @param {string|null|undefined|unknown} raw
 * @returns {WorksheetCustomAuditEntry[]}
 */
export function parseWorksheetCustomAuditAreasJson(raw) {
  if (raw == null || raw === "") return [];
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(v)) return [];
    const out = [];
    for (const x of v) {
      if (x && typeof x === "object") {
        const id = String(x.id ?? "").trim();
        let label = String(x.label ?? "").trim();
        if (id && label) {
          label = label.toLocaleUpperCase("en-US");
          out.push({ id, label });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Restore selected paths from DB (`audit_area`) + optional custom entries.
 * Custom paths use `custom:<id>`.
 * @param {string|null|undefined} storedValue
 * @param {{ path: string, label: string }[]} flatRows from flattenAuditAreaTree(...)
 * @param {WorksheetCustomAuditEntry[]} [customEntries]
 * @returns {Set<string>}
 */
export function pathSetFromStoredWorksheetAuditArea(storedValue, flatRows, customEntries = []) {
  const s = String(storedValue ?? "").trim();
  const builtinPaths = flatRows.map((r) => r.path);
  const customPaths = customEntries.map((e) => `custom:${e.id}`);
  const allPaths = [...builtinPaths, ...customPaths];

  if (!s) return new Set();

  if (s === WORKSHEET_AUDIT_AREA_ALL_LABEL) return new Set(allPaths);

  const displayed = displayWorksheetAuditArea(s);
  if (displayed === WORKSHEET_AUDIT_AREA_ALL_LABEL) return new Set(allPaths);

  const labelToPath = new Map();
  for (const row of flatRows) {
    if (!labelToPath.has(row.label)) labelToPath.set(row.label, row.path);
  }
  for (const e of customEntries) {
    const L = String(e.label || "").trim();
    if (L && !labelToPath.has(L)) labelToPath.set(L, `custom:${e.id}`);
  }

  const parts = s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  const paths = new Set();
  for (const part of parts) {
    const p = labelToPath.get(part);
    if (p != null) paths.add(p);
  }
  return paths;
}
