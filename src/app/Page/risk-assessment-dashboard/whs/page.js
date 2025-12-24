"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewWarehouseInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useWarehouseStore } from "@/app/stores/RiskAssessement/whsStore";
import { DataTable } from "@/app/components/ui/Risk-Assessment/DataTable";
import { exportToStyledExcel } from "@/app/utils/exportExcel";

export default function Warehouse() {
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
  const loadWarehouse = useWarehouseStore((s) => s.loadWarehouse);

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
          const warehouse = useWarehouseStore.getState().warehouse;
          if (!warehouse || warehouse.length === 0) {
            alert("Tidak ada data untuk diexport");
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
          await loadWarehouse("draft");
        },
      },
      {
        name: "View Published",
        action: async () => {
          setViewDraft(false);
          setConvertMode(false);
          setEditMode(false);
          await loadWarehouse("published");
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
    const load = useCallback(
      () => loadWarehouse(viewDraft ? "draft" : "published"),
      [loadWarehouse, viewDraft]
    );

    useEffect(() => {
      load();
    }, [load]);

    const warehouse = useWarehouseStore((s) => s.warehouse);

    const sortedWarehouse = useMemo(() => {
      if (!sortOption || !warehouse) return warehouse;

      return [...warehouse].sort((a, b) => {
        const valA = a[sortOption.key];
        const valB = b[sortOption.key];
        if (valA === undefined || valB === undefined) return 0;

        if (sortOption.order === "asc") return valA > valB ? 1 : -1;
        else return valA < valB ? 1 : -1;
      });
    }, [warehouse, sortOption]);

    return (
      <DataTable
        items={sortedWarehouse}
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
          label="Risk Assessment Form Warehouse"
          items={items}
          viewItems={isAdmin ? viewItems : []} 
          editItems={editItems}
          sortByItems={sortByItems}
          onSearch={setSearchQuery}
        />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && (
            <NewWarehouseInput
              onClose={() => {
                closePopUp();
                setSelectedItem(null);
                loadWarehouse(viewDraft ? "draft" : "published");
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
