/** Client-safe pipeline labels (no Node/fs imports). */

export const REPORT_PIPELINE_STEPS = [
  { key: "modules", label: "Data modul (SOP, Audit Review, Worksheet, …)" },
  { key: "generate", label: "Generate DOCX (Report Service)" },
  { key: "store", label: "Simpan file (data/reports/)" },
  { key: "onlyoffice", label: "ONLYOFFICE — preview & edit" },
  { key: "download", label: "Unduh DOCX / export PDF" },
];
