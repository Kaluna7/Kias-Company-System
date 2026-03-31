/**
 * Hierarki AUDIT AREA untuk worksheet (multi-checkbox).
 * Label mengikuti screenshot user (uppercase).
 */
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
