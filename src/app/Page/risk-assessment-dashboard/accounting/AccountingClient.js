"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { Search } from "@/app/components/features/Button";
import { NewAccountingInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useAccountingStore } from "@/app/stores/RiskAssessement/accountingStore";
import { DataTable } from "@/app/components/ui/Risk-Assessment/DataTable";
import { exportToStyledExcel } from "@/app/utils/exportExcel";
import { compareCode } from "@/app/utils/compareCode";

export default function AccountingClient({ initialData = [] }) {
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
  const loadAccounting = useAccountingStore((s) => s.loadAccounting);
  const setAccounting = useAccountingStore((s) => s.setAccounting);

  // Initialize store with server data
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setAccounting(initialData);
    }
  }, [initialData, setAccounting]);

  // ✅ Menu tombol utama (hanya admin yang punya tombol New Data + Export)
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
          const accountings = useAccountingStore.getState().accounting;
          if (!accountings || accountings.length === 0) {
            alert("Tidak ada data untuk diexport");
            return;
          }

          const status = viewDraft ? "Draft" : "Published";
          exportToStyledExcel(accountings, null, status, "Accounting");
        },
        className: "bg-green-500 hover:bg-green-600 text-white",
      });
    }

    return base;
  }, [isAdmin, openPopUp, viewDraft, convertMode]);

  // ✅ Tombol "View Draft / Published" hanya admin
  const viewItems = useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
        name: "View Draft",
        action: async () => {
          setViewDraft(true);
          setConvertMode(false);
          setEditMode(false);
          await loadAccounting("draft");
        },
      },
      {
        name: "View Published",
        action: async () => {
          setViewDraft(false);
          setConvertMode(false);
          setEditMode(false);
          await loadAccounting("published");
        },
      },
    ];
  }, [isAdmin, loadAccounting]);

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

  function AccountingTableWrapper() {
    const load = useCallback(
      () => loadAccounting(viewDraft ? "draft" : "published"),
      [loadAccounting, viewDraft]
    );

    useEffect(() => {
      // Only load if we don't have initial data or if switching views
      // Skip loading if we already have initial data and viewing published
      if (viewDraft) {
        load();
      } else if (!initialData || initialData.length === 0) {
        load();
      }
    }, [load, viewDraft, initialData]);

    const accountings = useAccountingStore((s) => s.accounting);

    const sortedAccountings = useMemo(() => {
      if (!sortOption || !accountings) return accountings;

      return [...accountings].sort((a, b) => {
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
    }, [accountings, sortOption]);

    return (
      <DataTable
        items={sortedAccountings}
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
          label="Risk Assessment Form Accounting"
          fileItems={items}
          viewItems={isAdmin ? viewItems : []} 
          editItems={editItems}
          sortByItems={sortByItems}
          onSearch={setSearchQuery}
        />
        <div className="flex-1 w-full h-full overflow-hidden mt-20 md:mt-14">
          {/* Search bar untuk mobile - di atas table */}
          <div className="md:hidden px-4 pt-4 pb-2">
            <Search onSearch={setSearchQuery} />
          </div>
          {isOpen && (
            <NewAccountingInput
              onClose={() => {
                closePopUp();
                setSelectedItem(null);
                loadAccounting(viewDraft ? "draft" : "published");
              }}
              defaultData={selectedItem}
            />
          )}
          <AccountingTableWrapper />
        </div>
      </div>
    </main>
  );
}

