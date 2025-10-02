"use client";

import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewFinanceInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/RiskAssessement/popupStore";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useFinanceStore } from "@/app/stores/RiskAssessement/financeStore";
import { DataTable } from "@/app/components/ui/DataTable";

import * as XLSX from "xlsx-js-style";

function FinanceTable({ convertMode, onCloseConvert, viewDraft, loadFinance, searchQuery }) {
  const load = useCallback(() => {
    return loadFinance(viewDraft ? "draft" : "published");
  }, [loadFinance, viewDraft]);

  useEffect(() => {
    load();
  }, [load]);

  const finances = useFinanceStore((s) => s.finance);

  return (
    <DataTable
      items={finances}
      load={load}
      convertMode={convertMode}
      onCloseConvert={onCloseConvert}
      viewDraft={viewDraft}
      searchQuery={searchQuery}
    />
  );
}

export default function Finance() {
  const [convertMode, setConvertMode] = useState(false);
  const [viewDraft, setViewDraft] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);

  const loadFinance = useFinanceStore((s) => s.loadFinance);

  // Fungsi Export Excel yang Diperbaiki
  const exportToExcel = () => {
    const finances = useFinanceStore.getState().finance;
  
    if (!finances || finances.length === 0) {
      alert("Tidak ada data untuk diexport");
      return;
    }
  
    const dataForExcel = finances.map((f) => ({
      "RISK ID NO.": f.risk_id_no ?? `A.2.1.${f.risk_id}`,
      "Category": f.category || "",
      "Sub Department": f.sub_department || "",
      "SOP Related": f.sop_related || "",
      "Risk Description": f.risk_description || "",
      "Risk Details": f.risk_details || "",
      "Impact Description": f.impact_description || "",
      "Impact Level": f.impact_level || "",
      "Probability Level": f.probability_level || "",
      "Priority Level": f.priority_level || "",
      "Mitigation Strategy": f.mitigation_strategy || "",
      "Owners": f.owners || "",
      "Root Cause Category": f.root_cause_category || "",
      "Onset Timeframe": f.onset_timeframe || "",
      "Status": f.status || "",
    }));
  
    // Buat worksheet
    const worksheet = XLSX.utils.json_to_sheet([], { origin: 6 });
    
    // Definisikan styles - HAPUS BORDER DARI JUDUL
    const titleStyle = {
      font: { sz: 16, bold: true, color: { rgb: "2C3E50" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "FFFFFF" } }
      // Border dihapus dari judul
    };
    
    const subtitleStyle = {
      font: { sz: 14, bold: true, color: { rgb: "34495E" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "FFFFFF" } }
      // Border dihapus dari subtitle
    };
    
    const dateStyle = {
      font: { sz: 10, italic: true, color: { rgb: "666666" } },
      alignment: { horizontal: "center" },
      fill: { fgColor: { rgb: "FFFFFF" } }
      // Border dihapus dari date
    };
    
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
      fill: { fgColor: { rgb: "3498DB" } },
      alignment: { 
        horizontal: "center", 
        vertical: "center", 
        wrapText: true
      },
      border: {
        top: { style: "medium", color: { rgb: "000000" } },
        bottom: { style: "medium", color: { rgb: "000000" } },
        left: { style: "medium", color: { rgb: "000000" } },
        right: { style: "medium", color: { rgb: "000000" } }
      }
    };
    
    const cellStyle = {
      font: { sz: 9, color: { rgb: "2C3E50" } },
      alignment: { 
        vertical: "top", 
        horizontal: "left",
        wrapText: true,
        indent: 1
      },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      }
    };

    // Tambahkan judul dan informasi - DIPERBAIKI
    XLSX.utils.sheet_add_aoa(worksheet, [["PT KARYA PRIMA UNGGULAN"]], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, [["RISK ASSESSMENT FORM - FINANCE"]], { origin: "A2" });
    XLSX.utils.sheet_add_aoa(worksheet, [[`Data diexport pada: ${new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`]], { origin: "A3" });
    XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: "A4" });
    XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: "A5" });

    // Apply styles untuk judul - TANPA BORDER
    worksheet["A1"].s = titleStyle;
    worksheet["A2"].s = subtitleStyle;
    worksheet["A3"].s = dateStyle;

    // Merge cells untuk judul
    if (!worksheet["!merges"]) worksheet["!merges"] = [];
    worksheet["!merges"].push(
      { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }, // A1-N1
      { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } }, // A2-N2
      { s: { r: 2, c: 0 }, e: { r: 2, c: 13 } }  // A3-N3
    );

    // Tambahkan headers
    const headers = Object.keys(dataForExcel[0]);
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A6" });

    // Tambahkan data
    dataForExcel.forEach((row, index) => {
      const rowData = headers.map(header => row[header]);
      XLSX.utils.sheet_add_aoa(worksheet, [rowData], { origin: `A${7 + index}` });
    });

    // Dapatkan range data terbaru
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    
    // Atur lebar kolom yang optimal
    worksheet['!cols'] = [
      { wch: 12 },  // RISK ID NO.
      { wch: 15 },  // Category
      { wch: 18 },  // Sub Department
      { wch: 12 },  // SOP Related
      { wch: 35 },  // Risk Description - DILEBARKAN
      { wch: 45 },  // Risk Details - DILEBARKAN
      { wch: 35 },  // Impact Description - DILEBARKAN
      { wch: 12 },  // Impact Level
      { wch: 15 },  // Probability Level
      { wch: 12 },  // Priority Level
      { wch: 45 },  // Mitigation Strategy - DILEBARKAN
      { wch: 15 },  // Owners
      { wch: 18 },  // Root Cause Category
      { wch: 15 },  // Onset Timeframe
      { wch: 12 },  // Status
    ];

    // Apply styles untuk header (baris 6) - DENGAN BORDER
    const headerRow = 5; // Karena origin dimulai dari 6, jadi index 5
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = headerStyle;
      }
    }

    // Siapkan array untuk tinggi baris
    const rowHeights = [
      { hpt: 30 }, // Baris 1 - judul
      { hpt: 25 }, // Baris 2 - subjudul
      { hpt: 20 }, // Baris 3 - tanggal
      { hpt: 5 },  // Baris 4 - kosong
      { hpt: 5 },  // Baris 5 - kosong
      { hpt: 35 }, // Baris 6 - header
    ];

    // Apply styles untuk data rows dengan zebra striping - DENGAN BORDER
    for (let row = headerRow + 1; row <= range.e.r; row++) {
      const isEvenRow = (row - headerRow) % 2 === 1;
      const rowStyle = {
        ...cellStyle,
        fill: { fgColor: { rgb: isEvenRow ? "F8F9FA" : "FFFFFF" } }
      };
      
      let maxLinesInRow = 1;
      
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = rowStyle;
          
          // Hitung perkiraan jumlah baris teks
          const cellValue = worksheet[cellAddress].v;
          if (cellValue && cellValue.toString) {
            const text = cellValue.toString();
            const colWidth = worksheet['!cols'][col]?.wch || 20;
            const charsPerLine = Math.floor(colWidth * 1.8);
            const lines = Math.ceil(text.length / charsPerLine);
            if (lines > maxLinesInRow) {
              maxLinesInRow = lines;
            }
          }
        }
      }
      
      // Set tinggi baris berdasarkan jumlah baris teks maksimum
      const rowHeight = Math.max(25, Math.min(maxLinesInRow * 15, 150));
      rowHeights.push({ hpt: rowHeight });
    }

    worksheet['!rows'] = rowHeights;

    // Buat workbook dan simpan
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Risk Assessment Finance");
    
    XLSX.writeFile(workbook, `Risk_Assessment_Finance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // header items
  const items = useMemo(
    () => [
      { name: "New Data", action: () => openPopUp() },
      { 
        name: viewDraft ? "Convert To Publish" : "Convert To Draft", 
        action: () => setConvertMode((p) => !p) 
      },
      { 
        name: "Export Data", 
        action: () => exportToExcel(),
        className: "bg-green-500 hover:bg-green-600 text-white"
      },
    ],
    [openPopUp, viewDraft]
  );

  const viewItems = useMemo(
    () => [
      {
        name: "View Draft",
        action: async () => setViewDraft(true),
      },
      {
        name: "View Published",
        action: async () => setViewDraft(false),
      },
    ],
    []
  );

  return (
    <main className="flex flex-row w-full h-full min-h-screen">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader
          label="Risk Assessment Form Finance"
          items={items}
          viewItems={viewItems}
          onSearch={setSearchQuery}
        />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewFinanceInput onClose={closePopUp} />}

          <FinanceTable
            convertMode={convertMode} 
            onCloseConvert={() => setConvertMode(false)}
            viewDraft={viewDraft}
            loadFinance={loadFinance}
            searchQuery={searchQuery}
          />
        </div>
      </div>
    </main>
  );
}