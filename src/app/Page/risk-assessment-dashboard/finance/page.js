"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewFinanceInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useFinanceStore } from "@/app/stores/RiskAssessement/financeStore";
import { DataTable } from "@/app/components/ui/Risk-Assessment/DataTable";
import { exportToStyledExcel } from "@/app/utils/exportExcel";

export default function Finance() {
  const [convertMode, setConvertMode] = useState(false);
  const [viewDraft, setViewDraft] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState(null); 

  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);

  const loadFinance = useFinanceStore((s) => s.loadFinance);

  const items = useMemo(() => {
    const base = [];

    if (!viewDraft) {
      base.push({
        name: "New Data",
        action: () => {
          setSelectedItem(null);
          openPopUp();
        },
      });
    }

    base.push({
      name: viewDraft
        ? (convertMode ? "Cancel Convert" : "Convert To Publish")
        : (convertMode ? "Cancel Convert" : "Convert To Draft"),
      action: () => {
        setConvertMode((prev) => {
          const next = !prev;
          if (next) setEditMode(false);
          return next;
        });
      },
    });

    base.push({
      name: "Export Data",
      action: () => {
        const finances = useFinanceStore.getState().finance;
        if (!finances || finances.length === 0) {
          alert("Tidak ada data untuk diexport");
          return;
        }

        const status = viewDraft ? "Draft" : "Published";
        exportToStyledExcel(finances, null, status, "Finance");
      },
      className: "bg-green-500 hover:bg-green-600 text-white",
    });

    return base;
  }, [openPopUp, viewDraft, convertMode]);

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

  const editItems = useMemo(
    () =>
      viewDraft
        ? [
            {
              name: "Edit Data",
              action: () => {
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

  const sortByItems = useMemo(
    () => [
      {
        name: "Priority Level High to Low",
        action: () => setSortOption({ key: "priority_level", order: "desc" }),
      },
      {
        name: "Priority Level Low to High",
        action: () => setSortOption({ key: "priority_level", order: "asc" }),
      },
      {
        name: "Risk ID No High to Low",
        action: () => setSortOption({ key: "risk_id_no", order: "desc" }),
      },
      {
        name: "Risk ID No Low to High",
        action: () => setSortOption({ key: "risk_id_no", order: "asc" }),
      },
    ],
    []
  );

  function FinanceTableWrapper() {
    const load = useCallback(
      () => loadFinance(viewDraft ? "draft" : "published"),
      [loadFinance, viewDraft]
    );

    useEffect(() => {
      load();
    }, [load]);

    const finances = useFinanceStore((s) => s.finance);

    const sortedFinances = useMemo(() => {
      if (!sortOption || !finances) return finances;

      return [...finances].sort((a, b) => {
        const valA = a[sortOption.key];
        const valB = b[sortOption.key];
        if (valA === undefined || valB === undefined) return 0;

        if (sortOption.order === "asc") return valA > valB ? 1 : -1;
        else return valA < valB ? 1 : -1;
      });
    }, [finances, sortOption]);

    return (
      <DataTable
        items={sortedFinances}
        load={load}
        convertMode={convertMode}
        onCloseConvert={() => setConvertMode(false)}
        viewDraft={viewDraft}
        editMode={editMode}
        onEditRow={(item) => {
          setSelectedItem(item);
          openPopUp();
        }}
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
          sortByItems={sortByItems}
          onSearch={setSearchQuery}
        />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && (
            <NewFinanceInput
              onClose={() => {
                closePopUp();
                setSelectedItem(null);
                loadFinance(viewDraft ? "draft" : "published");
              }}
              defaultData={selectedItem}
            />
          )}

          <FinanceTableWrapper />
        </div>
      </div>
    </main>
  );
}
