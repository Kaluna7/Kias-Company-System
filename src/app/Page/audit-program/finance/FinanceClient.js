"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useFinanceStore } from "@/app/stores/AuditProgram/financeStore";
import DataTableAudit from "@/app/components/ui/AuditProgram/DataTableAudit";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { GenericInputModal } from "@/app/components/ui/GenericInput";
import { Search } from "@/app/components/features/Button";

export default function FinanceClient({ initialData, initialSortBy = "risk_id_no", initialSortDir = "asc" }) {
  const {
    data,
    loading,
    error,
    fetchFinanceData,
    sortBy,
    sortDir,
    setSort,
    moveToDraft,
    moveToPublish,
    setData: setStoreData,
  } = useFinanceStore();

  const { data: session } = useSession();
  const role = session?.user?.role ?? null;
  const isAdmin = role === "admin";

  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");

  const [showModal, setShowModal] = useState({
    open: false,
    mode: null,
    selectedRow: null,
  });
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [isMoveToDraftMode, setIsMoveToDraftMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [viewDraft, setViewDraft] = useState(false);

  // Set initial data dari server
  useEffect(() => {
    if (initialData) {
      setStoreData(initialData);
      setSort(initialSortBy, initialSortDir);
    }
  }, [initialData, initialSortBy, initialSortDir, setStoreData, setSort]);

  // File menu hanya untuk admin
  const fileItems = useMemo(() => {
    if (!isAdmin) return [];
    const items = [
      {
        name: "New Planning",
        modal: "new-planning",
      },
    ];
    
    if (viewDraft) {
      items.push({
        name: "Move to Publish",
        action: () => {
          setIsMoveToDraftMode(true);
        },
      });
      items.push({
        name: "Delete Data",
        action: () => {
          setIsDeleteMode(true);
        },
      });
    } else {
      items.push({
        name: "Move to Draft",
        action: () => {
          setIsMoveToDraftMode(true);
        },
      });
    }
    
    return items;
  }, [isAdmin, viewDraft]);

  // Opsi Sort By di header
  const sortByItems = useMemo(
    () => [
      {
        name: "Risk ID No Low to High",
        action: () => setSort("risk_id_no", "asc"),
      },
      {
        name: "Risk ID No High to Low",
        action: () => setSort("risk_id_no", "desc"),
      },
    ],
    [setSort]
  );

  // View Draft / Published untuk Audit Program
  const viewItems = useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
        name: "View Draft",
        action: async () => {
          setViewDraft(true);
          await fetchFinanceData({ q: "", page: 1, pageSize: 50, status: "draft", year: yearParam || undefined });
        },
      },
      {
        name: "View Published",
        action: async () => {
          setViewDraft(false);
          await fetchFinanceData({ q: "", page: 1, pageSize: 50, status: "published", year: yearParam || undefined });
        },
      },
    ];
  }, [isAdmin, fetchFinanceData]);

  // buka planning mode (event global)
  useEffect(() => {
    const handler = (e) => {
      if (e?.detail?.name === "new-planning") {
        setIsPlanningMode(true);
      }
    };
    window.addEventListener("open-modal", handler);
    return () => window.removeEventListener("open-modal", handler);
  }, []);

  // tutup planning mode (event global)
  useEffect(() => {
    const handler = () => {
      setIsPlanningMode(false);
      setIsMoveToDraftMode(false);
      setIsDeleteMode(false);
    };
    window.addEventListener("close-planning-mode", handler);
    return () => window.removeEventListener("close-planning-mode", handler);
  }, []);

  // buka modal add-ap
  useEffect(() => {
    const handler = (e) => {
      if (e?.detail?.name === "add-ap") {
        setShowModal({
          open: true,
          mode: "add-ap",
          selectedRow: e.detail.row ?? null,
        });
      }
    };
    window.addEventListener("open-modal", handler);
    return () => window.removeEventListener("open-modal", handler);
  }, []);

  // submit AP ke backend
  const handleSubmitNewFinanceAp = async (finance_risk_id, payload) => {
    const res = await fetch("/api/AuditProgram/finance/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        finance_risk_id,
        ...payload,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || "Failed to add Audit Program");
    }
    await fetchFinanceData({
      q: "",
      page: 1,
      pageSize: 50,
      status: viewDraft ? "draft" : "published",
      year: yearParam || undefined,
    });
    setShowModal({ open: false, mode: null, selectedRow: null });
    setIsPlanningMode(false);
  };

  const listFormAp = [
    { label: "Substantive Test", placeholder: "Masukkan tes substantif" },
    { label: "Objective", placeholder: "Masukkan tujuan AP" },
    { label: "Procedures", placeholder: "Jelaskan prosedur (bisa multiline)" },
    { label: "Method", placeholder: "Metode sampling / pengujian" },
    { label: "Description", placeholder: "Deskripsi singkat" },
    { label: "Application", placeholder: "Aplikasi / sistem terkait" },
  ];

  const labelToKeyAp = {
    "Substantive Test": "substantive_test",
    Objective: "objective",
    Procedures: "procedures",
    Method: "method",
    Description: "description",
    Application: "application",
  };

  const textareaLabels = new Set(["Procedures", "Description"]);

  return (
    <main className="flex flex-col w-full h-screen overflow-hidden">
      <div className="flex flex-col flex-1 w-full h-full">
        <SmallHeader
          label={`Finance Audit Program - ${viewDraft ? "Draft Data" : "Published Data"}`}
          fileItems={fileItems}
          viewItems={viewItems}
          sortByItems={sortByItems}
          onSearch={(v) =>
            fetchFinanceData({
              q: v,
              page: 1,
              pageSize: 50,
              status: viewDraft ? "draft" : "published",
              year: yearParam || undefined,
            })
          }
        />
        <div className="flex-1 w-full h-full overflow-hidden mt-20 md:mt-14">
          {/* Search bar untuk mobile - di atas table */}
          <div className="md:hidden px-4 pt-4 pb-2">
            <Search 
              onSearch={(v) =>
                fetchFinanceData({
                  q: v,
                  page: 1,
                  pageSize: 50,
                  status: viewDraft ? "draft" : "published",
                  year: yearParam || undefined,
                })
              } 
            />
          </div>
          
          {loading && (
            <p className="text-center text-gray-500 py-6">Loading data...</p>
          )}
          {error && (
            <p className="text-center text-red-500 py-6">Error: {error}</p>
          )}
          {!loading && (
            <DataTableAudit
              data={data}
              isPlanningMode={isPlanningMode}
              isMoveToDraftMode={isMoveToDraftMode}
              isDeleteMode={isDeleteMode}
              viewDraft={viewDraft}
              sortBy={sortBy}
              sortDir={sortDir}
              onChangeSort={setSort}
              onMoveToDraft={viewDraft ? moveToPublish : moveToDraft}
              onDelete={async (riskId, departmentApi) => {
                try {
                  const res = await fetch(`/api/AuditProgram/${departmentApi}/${riskId}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const error = await res.json().catch(() => ({ error: "Failed to delete" }));
                    throw new Error(error.error || "Failed to delete");
                  }
                  await fetchFinanceData({
                    q: "",
                    page: 1,
                    pageSize: 50,
                    status: "draft",
                  });
                } catch (err) {
                  if (typeof window !== "undefined" && window.__showToast) window.__showToast(`Error deleting record: ${err.message}`, "error"); else alert(`Error deleting record: ${err.message}`);
                  throw err;
                }
              }}
              departmentApi="finance"
            />
          )}
        </div>
      </div>

      {/* Modal Add AP */}
      {showModal.open && showModal.mode === "add-ap" && (
        <GenericInputModal
          title={`Add AP for ${showModal.selectedRow?.risk_id_no ?? ""}`}
          onClose={() =>
            setShowModal({ open: false, mode: null, selectedRow: null })
          }
          onSubmit={(payload) =>
            handleSubmitNewFinanceAp(showModal.selectedRow?.risk_id, payload)
          }
          listForm={listFormAp}
          labelToKey={labelToKeyAp}
          textareaLabels={textareaLabels}
          numericFields={new Set()}
          initialForm={null}
        />
      )}
    </main>
  );
}

