"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewFinanceInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/RiskAssessement/popupStore";
import { useFinanceStore } from "@/app/stores/RiskAssessement/financeStore";
import { DataTable } from "@/app/components/ui/DataTable";
import { exportToStyledExcel } from "@/app/utils/exportExcel";

export default function Finance() {
  const [convertMode, setConvertMode] = useState(false);
  const [viewDraft, setViewDraft] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);

  const loadFinance = useFinanceStore((s) => s.loadFinance);

  // header items: Convert toggles convertMode; when enabling convertMode disable editMode
  const items = useMemo(
    () => [
      { name: "New Data", action: () => { setSelectedItem(null); openPopUp(); } },
      {
        name: viewDraft ? (convertMode ? "Cancel Convert" : "Convert To Publish") : (convertMode ? "Cancel Convert" : "Convert To Draft"),
        action: () => {
          // toggle convert mode; when enabling convertMode, make sure editMode is false
          setConvertMode((prev) => {
            const next = !prev;
            if (next) setEditMode(false);
            return next;
          });
        },
      },
      {
        name: "Export Data",
        action: () => {
          const finances = useFinanceStore.getState().finance; // ambil data dari store
      
          if (!finances || finances.length === 0) {
            alert("Tidak ada data untuk diexport");
            return;
          }
      
          const status = viewDraft ? "Draft" : "Published";
          const now = new Date();
          const fileName = `Finance_${status}_${now.toISOString().slice(0,10).replace(/-/g, "")}.xlsx`;
      
          exportToStyledExcel(finances, "Finance", status, now, fileName);
        },
        className: "bg-green-500 hover:bg-green-600 text-white",
      }
      
    ],
    [openPopUp, viewDraft, convertMode]
  );

  // view menu: switch between Draft / Published
  const viewItems = useMemo(
    () => [
      {
        name: "View Draft",
        action: async () => {
          setViewDraft(true);
          setConvertMode(false);
          setEditMode(false);
          await loadFinance("draft");
        },
      },
      {
        name: "View Published",
        action: async () => {
          setViewDraft(false);
          setConvertMode(false);
          setEditMode(false);
          await loadFinance("published");
        },
      },
    ],
    [loadFinance]
  );

  // edit menu (visible only when viewing draft)
  const editItems = useMemo(
    () =>
      viewDraft
        ? [
            {
              name: "Edit Data",
              action: () => {
                // toggle edit mode; when enabling editMode, disable convertMode
                setEditMode((prev) => {
                  const next = !prev;
                  if (next) setConvertMode(false);
                  return next;
                });
              },
            },
          ]
        : [],
    [viewDraft]
  );

  // callback when user clicks Edit (on a row)
  const handleEditRow = (item) => {
    setSelectedItem(item);
    openPopUp();
  };

  // Finance table wrapper to pass loader and states
  function FinanceTableWrapper() {
    const load = useCallback(() => loadFinance(viewDraft ? "draft" : "published"), [loadFinance, viewDraft]);
    useEffect(() => { load(); }, [load]);

    const finances = useFinanceStore((s) => s.finance);

    return (
      <DataTable
        items={finances}
        load={load}
        convertMode={convertMode}
        onCloseConvert={() => setConvertMode(false)}
        viewDraft={viewDraft}
        editMode={editMode}
        onEditRow={handleEditRow}
        searchQuery={searchQuery}
      />
    );
  }

  return (
    <main className="flex flex-row w-full h-full min-h-screen">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader
          label="Risk Assessment Form Finance"
          items={items}
          viewItems={viewItems}
          editItems={editItems}
          onSearch={setSearchQuery}
        />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && (
            <NewFinanceInput
              onClose={() => {
                closePopUp();
                setSelectedItem(null);
                // jika selesai editing, refresh list
                loadFinance(viewDraft ? "draft" : "published");
              }}
              defaultData={selectedItem} // NewFinanceInput harus support ini
            />
          )}

          <FinanceTableWrapper />
        </div>
      </div>
    </main>
  );
}
