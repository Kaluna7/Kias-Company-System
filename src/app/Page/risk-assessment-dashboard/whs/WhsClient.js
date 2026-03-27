"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { Search } from "@/app/components/features/Button";
import { NewWarehouseInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useWarehouseStore } from "@/app/stores/RiskAssessement/whsStore";
import { DataTable } from "@/app/components/ui/Risk-Assessment/DataTable";
import Pagination from "@/app/components/ui/Pagination";
import { exportToStyledExcel } from "@/app/utils/exportExcel";
import { compareCode } from "@/app/utils/compareCode";

export default function WhsClient({ initialData = [], initialMeta = null }) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "admin";

  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");

  const [convertMode, setConvertMode] = useState(false);
  const [viewDraft, setViewDraft] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState(null);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const isLoadingRef = useRef(false);

  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);
  const loadWarehouse = useWarehouseStore((s) => s.loadWarehouse);
  const setWarehouseAndMeta = useWarehouseStore((s) => s.setWarehouseAndMeta);

  const initDoneRef = useRef(false);
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    if (initialData?.length > 0 || initialMeta) {
      setWarehouseAndMeta(initialData ?? [], initialMeta);
    }
  }, [initialData, initialMeta, setWarehouseAndMeta]);

  const skipLoadForPublishedRef = useRef(!!(initialData?.length > 0));

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
          const warehouse = useWarehouseStore.getState().warehouse;
          if (!warehouse || warehouse.length === 0) {
            if (typeof window !== "undefined" && window.__showToast) window.__showToast("Tidak ada data untuk diexport", "error"); else alert("Tidak ada data untuk diexport");
            return;
          }
          const status = viewDraft ? "Draft" : "Published";
          exportToStyledExcel(warehouse, null, status, "Warehouse");
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
          if (isLoadingRef.current) return; // Prevent multiple clicks
          isLoadingRef.current = true;
          try {
            setViewDraft(true);
            setConvertMode(false);
            setEditMode(false);
            await loadWarehouse("draft", 1, 50, yearParam || undefined);
          } finally {
            isLoadingRef.current = false;
          }
        },
      },
      {
        name: "View Published",
        action: async () => {
          if (isLoadingRef.current) return; // Prevent multiple clicks
          isLoadingRef.current = true;
          try {
            setViewDraft(false);
            setConvertMode(false);
            setEditMode(false);
            await loadWarehouse("published", 1, 50, yearParam || undefined);
          } finally {
            isLoadingRef.current = false;
          }
        },
      },
    ];
  }, [isAdmin, loadWarehouse]);

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

  function WarehouseTableWrapper() {
    const meta = useWarehouseStore((s) => s.meta);
    const load = useCallback(
      async (page) => {
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;
        setPaginationLoading(true);
        try {
          await loadWarehouse(
            viewDraft ? "draft" : "published",
            page ?? meta?.page ?? 1,
            meta?.pageSize ?? 50,
            yearParam || undefined
          );
        } finally {
          isLoadingRef.current = false;
          setPaginationLoading(false);
        }
      },
      [loadWarehouse, viewDraft, meta?.page, meta?.pageSize]
    );

    const prevViewDraftRef = useRef(viewDraft);
    useEffect(() => {
      const viewDraftChanged = prevViewDraftRef.current !== viewDraft;
      prevViewDraftRef.current = viewDraft;
      if (!viewDraftChanged) {
        if (viewDraft) load(1);
        else if (!skipLoadForPublishedRef.current) load(1);
        return;
      }
      load(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewDraft]);

    const warehouse = useWarehouseStore((s) => s.warehouse);
    const sortedWarehouse = useMemo(() => {
      if (!sortOption || !warehouse) return warehouse;
      return [...warehouse].sort((a, b) => {
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
    }, [warehouse, sortOption]);

    return (
      <>
        <DataTable
          apiPath="whs"
          items={sortedWarehouse}
          load={() => load(meta?.page ?? 1)}
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
        <Pagination meta={meta} onPageChange={(p) => load(p)} loading={paginationLoading} />
      </>
    );
  }

  return (
    <main className="flex flex-col w-full h-screen overflow-hidden">
      <div className="flex flex-col flex-1 w-full h-full">
        <SmallHeader
          label="Risk Assessment Form Warehouse"
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
            <NewWarehouseInput
              onClose={() => {
                closePopUp();
                setSelectedItem(null);
                loadWarehouse(viewDraft ? "draft" : "published", 1, 50, yearParam || undefined);
              }}
              defaultData={selectedItem}
            />
          )}
          <WarehouseTableWrapper />
        </div>
      </div>
    </main>
  );
}

