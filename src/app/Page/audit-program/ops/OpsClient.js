"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useOpsStore } from "@/app/stores/AuditProgram/opsStore";
import DataTableAudit from "@/app/components/ui/AuditProgram/DataTableAudit";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { GenericInputModal } from "@/app/components/ui/GenericInput";
import { Search } from "@/app/components/features/Button";
import { isAdminRole } from "@/lib/roles";

export default function OpsClient({ initialData, initialSortBy = "risk_id_no", initialSortDir = "asc" }) {
  const {
    data,
    loading,
    error,
    fetchOpsData,
    sortBy,
    sortDir,
    setSort,
    moveToDraft,
    moveToPublish,
    setData: setStoreData,
  } = useOpsStore();

  const { data: session } = useSession();
  const role = session?.user?.role ?? null;
  const isAdmin = isAdminRole(role);

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewDraft, setViewDraft] = useState(false);

  useEffect(() => {
    if (initialData) {
      setStoreData(initialData);
      setSort(initialSortBy, initialSortDir);
    }
  }, [initialData, initialSortBy, initialSortDir, setStoreData, setSort]);

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
        name: "Edit Data",
        action: () => {
          setIsEditMode(true);
        },
      });
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

  const viewItems = useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
        name: "View Draft",
        action: async () => {
          setViewDraft(true);
          await fetchOpsData({ q: "", page: 1, pageSize: 50, status: "draft", year: yearParam || undefined });
        },
      },
      {
        name: "View Published",
        action: async () => {
          setViewDraft(false);
          await fetchOpsData({ q: "", page: 1, pageSize: 50, status: "published", year: yearParam || undefined });
        },
      },
    ];
  }, [isAdmin, fetchOpsData]);

  useEffect(() => {
    const handler = (e) => {
      if (e?.detail?.name === "new-planning") {
        setIsPlanningMode(true);
      }
    };
    window.addEventListener("open-modal", handler);
    return () => window.removeEventListener("open-modal", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsPlanningMode(false);
      setIsMoveToDraftMode(false);
      setIsDeleteMode(false);
      setIsEditMode(false);
    };
    window.addEventListener("close-planning-mode", handler);
    return () => window.removeEventListener("close-planning-mode", handler);
  }, []);

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

  const handleSubmitOpsAp = async (operational_risk_id, payload) => {
    const isEditAp = Boolean(payload?.ap_id);
    const res = await fetch("/api/AuditProgram/ops/", {
      method: isEditAp ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operational_risk_id,
        ...payload,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || "Failed to add Audit Program");
    }
    await fetchOpsData({
      q: "",
      page: 1,
      pageSize: 50,
      status: viewDraft ? "draft" : "published",
      year: yearParam || undefined,
    });
    setShowModal({ open: false, mode: null, selectedRow: null });
    setIsPlanningMode(false);
    setIsEditMode(false);
  };

  const listFormAp = [
    { label: "Substantive Test", placeholder: "Enter substantive test" },
    { label: "Objective", placeholder: "Enter AP objective" },
    { label: "Procedures", placeholder: "Describe procedures (multiline allowed)" },
    { label: "Method", placeholder: "Sampling/testing method" },
    { label: "Description", placeholder: "Short description" },
    { label: "Application", placeholder: "Related application/system" },
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
    <main className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-slate-50">
      <SmallHeader
          label={`Operational Audit Program - ${viewDraft ? "Draft Data" : "Published Data"}`}
          backHref={`/Page/audit-program${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ""}`}
          fileItems={fileItems}
          viewItems={viewItems}
          sortByItems={sortByItems}
          onSearch={(v) =>
            fetchOpsData({
              q: v,
              page: 1,
              pageSize: 50,
              status: viewDraft ? "draft" : "published",
              year: yearParam || undefined,
            })
          }
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-14">
          <div className="shrink-0 md:hidden px-3 py-2">
            <Search 
              onSearch={(v) =>
                fetchOpsData({
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
            <p className="shrink-0 text-center text-gray-500 py-4">Loading data...</p>
          )}
          {error && (
            <p className="shrink-0 text-center text-red-500 px-3 py-4">Error: {error}</p>
          )}
          {!loading && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DataTableAudit
              data={data}
              isPlanningMode={isPlanningMode}
              isMoveToDraftMode={isMoveToDraftMode}
              isDeleteMode={isDeleteMode}
              isEditMode={isEditMode}
              viewDraft={viewDraft}
              sortBy={sortBy}
              sortDir={sortDir}
              onChangeSort={setSort}
              onMoveToDraft={viewDraft ? moveToPublish : moveToDraft}
              onEditAp={(apRow) => {
                if (!apRow?.ap_id) return;
                setShowModal({
                  open: true,
                  mode: "edit-ap",
                  selectedRow: apRow,
                });
              }}
              onDeleteAp={async (apRow, deptApi) => {
                try {
                  const res = await fetch(`/api/AuditProgram/${deptApi}/ap/${apRow.ap_id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const error = await res.json().catch(() => ({ error: "Failed to delete AP" }));
                    throw new Error(error.error || "Failed to delete AP");
                  }
                  await fetchOpsData({ q: "", page: 1, pageSize: 50, status: viewDraft ? "draft" : "published", year: yearParam || undefined });
                } catch (err) {
                  if (typeof window !== "undefined" && window.__showToast) window.__showToast(`Error deleting AP: ${err.message}`, "error"); else alert(`Error deleting AP: ${err.message}`);
                  throw err;
                }
              }}
              onDelete={async (riskId, departmentApi) => {
                try {
                  const res = await fetch(`/api/AuditProgram/${departmentApi}/${riskId}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const error = await res.json().catch(() => ({ error: "Failed to delete" }));
                    throw new Error(error.error || "Failed to delete");
                  }
                  await fetchOpsData({
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
              departmentApi="ops"
            />
                      </div>

          )}
        </div>

      {showModal.open && (showModal.mode === "add-ap" || showModal.mode === "edit-ap") && (
        <GenericInputModal
          title={`${showModal.mode === "edit-ap" ? "Edit AP for" : "Add AP for"} ${showModal.selectedRow?.risk_id_no ?? ""}`}
          onClose={() =>
            setShowModal({ open: false, mode: null, selectedRow: null })
          }
          onSubmit={(payload) =>
            handleSubmitOpsAp(showModal.selectedRow?.risk_id, {
              ...payload,
              ...(showModal.mode === "edit-ap" ? { ap_id: showModal.selectedRow?.ap_id } : {}),
            })
          }
          listForm={listFormAp}
          labelToKey={labelToKeyAp}
          textareaLabels={textareaLabels}
          numericFields={new Set()}
          initialForm={
            showModal.mode === "edit-ap"
              ? {
                  substantive_test: showModal.selectedRow?.substantive_test ?? "",
                  objective: showModal.selectedRow?.objective ?? "",
                  procedures: showModal.selectedRow?.procedures ?? "",
                  method: showModal.selectedRow?.method ?? "",
                  description: showModal.selectedRow?.description ?? "",
                  application: showModal.selectedRow?.application ?? "",
                }
              : null
          }
        />
      )}
    </main>
  );
}

