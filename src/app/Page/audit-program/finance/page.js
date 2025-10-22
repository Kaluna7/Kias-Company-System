"use client";
import { useEffect, useState, useMemo } from "react";
import { useFinanceStore } from "@/app/stores/AuditProgram/financeStore";
import DataTableAudit from "@/app/components/ui/AuditProgram/DataTableAudit";
import SmallHeader from "@/app/components/layout/SmallHeader";
import SmallSidebar from "@/app/components/layout/SmallSidebar";
import { GenericInputModal } from "@/app/components/ui/GenericInput";

export default function FinancePage() {
  const { data, loading, error, fetchFinanceData } = useFinanceStore();

  const [showModal, setShowModal] = useState({
    open: false,
    mode: null,
    selectedRow: null,
  });
  const [isPlanningMode, setIsPlanningMode] = useState(false);

  useEffect(() => {
    fetchFinanceData().catch(() => {});
  }, [fetchFinanceData]);

  const fileItems = useMemo(
    () => [
      {
        name: "New Planning",
        modal: "new-planning",
      },
    ],
    []
  );

  // buka planning mode dari event global (mis. SmallHeader dispatch)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.name === "new-planning") {
        setIsPlanningMode(true);
      }
    };
    window.addEventListener("open-modal", handler);
    return () => window.removeEventListener("open-modal", handler);
  }, []);

  // buka modal add-ap ketika tombol pensil di DataTableAudit dispatch
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.name === "add-ap") {
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
      throw new Error(txt || "Gagal menambahkan Audit Program");
    }
    await fetchFinanceData();
    // parent akan menutup modal karena GenericInputModal memanggil onClose setelah onSubmit resolves
    setShowModal({ open: false, mode: null, selectedRow: null });
    setIsPlanningMode(false);
  };

  // ▶ listForm untuk modal — label harus sesuai yang GenericInputModal akan render
  const listFormAp = [
    { label: "AP Code", placeholder: "Masukkan kode AP" },
    { label: "Substantive Test", placeholder: "Masukkan tes substantif" },
    { label: "Objective", placeholder: "Masukkan tujuan AP" },
    { label: "Procedures", placeholder: "Jelaskan prosedur (bisa multiline)" },
    { label: "Method", placeholder: "Metode sampling / pengujian" },
    { label: "Description", placeholder: "Deskripsi singkat" },
    { label: "Application", placeholder: "Aplikasi / sistem terkait" },
  ];

  // ▶ labelToKey: mapping label -> key yang akan dipakai di payload (harus cocok dengan backend)
  const labelToKeyAp = {
    "AP Code": "ap_code",
    "Substantive Test": "substantive_test",
    Objective: "objective",
    Procedures: "procedures",
    Method: "method",
    Description: "description",
    Application: "application",
  };

  // kalau mau jadikan beberapa field sebagai textarea pada modalmu, pakai textareaLabels
  const textareaLabels = new Set(["Procedures", "Description"]);

  return (
    <main className="flex flex-row w-full h-full min-h-screen">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader
          label="Finance Audit Program"
          fileItems={fileItems}
          onSearch={(v) => fetchFinanceData({ q: v })}
        />
        <div className="mt-12 ml-14 flex-1">
          {loading && <p className="text-center text-gray-500 py-6">Loading data...</p>}
          {error && <p className="text-center text-red-500 py-6">Error: {error}</p>}
          {!loading && (
            <DataTableAudit data={data} isPlanningMode={isPlanningMode} />
          )}
        </div>
      </div>

      {/* Modal Add AP — gunakan GenericInputModal milikmu (tidak diubah) */}
      {showModal.open && showModal.mode === "add-ap" && (
        <GenericInputModal
          title={`Add AP for ${showModal.selectedRow?.risk_id_no ?? ""}`}
          onClose={() => setShowModal({ open: false, mode: null, selectedRow: null })}
          onSubmit={(payload) => handleSubmitNewFinanceAp(showModal.selectedRow?.risk_id, payload)}
          listForm={listFormAp}
          labelToKey={labelToKeyAp}
          textareaLabels={textareaLabels}
          numericFields={new Set()} // tidak ada numeric field untuk AP; ubah jika perlu
          initialForm={null}
        />
      )}
    </main>
  );
}
