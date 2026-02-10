"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { Search } from "@/app/components/features/Button";
import { NewTaxInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useTaxStore } from "@/app/stores/RiskAssessement/taxStore";
import { DataTable } from "@/app/components/ui/Risk-Assessment/DataTable";
import { exportToStyledExcel } from "@/app/utils/exportExcel";
import { compareCode } from "@/app/utils/compareCode";

export default function TaxClient({ initialData = [] }) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "admin";

  const [convertMode, setConvertMode] = useState(false);
  const [viewDraft, setViewDraft] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState(null);

  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);
  const loadTax = useTaxStore((s) => s.loadTax);
  const setTax = useTaxStore((s) => s.setTax);

  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setTax(initialData);
    }
  }, [initialData, setTax]);

  const items = useMemo(() => {
    const base = [];
    if (isAdmin && !viewDraft) {
      base.push({
        name: "New Data",
        action: () => {
          setSelectedItem(null);
          openPopUp();
        },
      });
    }
    if (isAdmin) {
      base.push({
        name: viewDraft
          ? convertMode
            ? "Cancel Convert"
            : "Convert To Publish"
          : convertMode
          ? "Cancel Convert"
          : "Convert To Draft",
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
          const tax = useTaxStore.getState().tax;
          if (!tax || tax.length === 0) {
            alert("Tidak ada data untuk diexport");
            return;
          }
          const status = viewDraft ? "Draft" : "Published";
          exportToStyledExcel(tax, null, status, "Tax");
        },
        className: "bg-green-500 hover:bg-green-600 text-white",
      });
    }
    return base;
  }, [isAdmin, openPopUp, viewDraft, convertMode]);

  const viewItems = useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
        name: "View Draft",
        action: async () => {
          setViewDraft(true);
          setConvertMode(false);
          setEditMode(false);
          await loadTax("draft");
        },
      },
      {
        name: "View Published",
        action: async () => {
          setViewDraft(false);
          setConvertMode(false);
          setEditMode(false);
          await loadTax("published");
        },
      },
    ];
  }, [isAdmin, loadTax]);

  const editItems = useMemo(
    () =>
      isAdmin && viewDraft
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
    [isAdmin, viewDraft]
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

  function TaxTableWrapper() {
    const load = useCallback(
      () => loadTax(viewDraft ? "draft" : "published"),
      [loadTax, viewDraft]
    );

    useEffect(() => {
      if (!initialData || initialData.length === 0 || viewDraft) {
        load();
      }
    }, [load, viewDraft, initialData]);

    const tax = useTaxStore((s) => s.tax);
    const sortedTax = useMemo(() => {
      if (!sortOption || !tax) return tax;
      return [...tax].sort((a, b) => {
        const valA = a[sortOption.key];
        const valB = b[sortOption.key];
        if (valA === undefined || valB === undefined) return 0;
        if (sortOption.key === "risk_id_no") {
          const cmp = compareCode(valA, valB);
          return sortOption.order === "asc" ? cmp : -cmp;
        }
        if (sortOption.order === "asc") return valA > valB ? 1 : -1;
        else return valA < valB ? 1 : -1;
      });
    }, [tax, sortOption]);

    return (
      <DataTable
        items={sortedTax}
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
    <main className="flex flex-col w-full h-screen overflow-hidden">
      <div className="flex flex-col flex-1 w-full h-full">
        <SmallHeader
          label="Risk Assessment Form Tax"
          fileItems={items}
          viewItems={isAdmin ? viewItems : []} 
          editItems={editItems}
          sortByItems={sortByItems}
          onSearch={setSearchQuery}
        />
        <div className="flex-1 w-full h-full overflow-hidden mt-20 md:mt-14">
          <div className="md:hidden px-4 pt-4 pb-2">
            <Search onSearch={setSearchQuery} />
          </div>
          {isOpen && (
            <NewTaxInput
              onClose={() => {
                closePopUp();
                setSelectedItem(null);
                loadTax(viewDraft ? "draft" : "published");
              }}
              defaultData={selectedItem}
            />
          )}
          <TaxTableWrapper />
        </div>
      </div>
    </main>
  );
}

