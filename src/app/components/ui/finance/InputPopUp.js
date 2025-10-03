"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GenericInputModal } from "./GenericInput";
import { useFinanceStore } from "@/app/stores/RiskAssessement/financeStore";

// NewFinanceInput — versi yang aman terhadap Rules of Hooks
export function NewFinanceInput({ onClose, defaultData = null }) {
  const createFinance = useFinanceStore((s) => s.createFinance);
  const updateFinanceFromStore = useFinanceStore((s) => s.updateFinance);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  // Dynamic import dijalankan di effect — ini tidak mengubah urutan Hook
  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/Data")
      .then((mod) => {
        if (!mounted) return;
        setDataModule(mod);
        setModuleError(null);
        setLoadingModule(false);
      })
      .catch((err) => {
        console.error("Failed to load data module:", err);
        if (!mounted) return;
        setModuleError(err);
        setDataModule(null);
        setLoadingModule(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // --- prepare safe values (dipanggil setiap render, hooks berikut juga dipanggil)
  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListFinance)
    ? Data.ListFinance
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_FINANCE ||
    Data.LABEL_TO_KEYS ||
    Data.LABELS_TO_KEYS ||
    {};

  const NUMERIC_FIELDS_RAW = Array.isArray(Data.NUMERIC_FIELDS)
    ? Data.NUMERIC_FIELDS
    : Array.isArray(Data.NUMERIC_FIELDS_SET)
    ? Data.NUMERIC_FIELDS_SET
    : Array.isArray(Data.NumericFields)
    ? Data.NumericFields
    : [];

  const TEXTAREA_LABELS_RAW = Array.isArray(Data.TEXTAREA_LABELS)
    ? Data.TEXTAREA_LABELS
    : Array.isArray(Data.TEXTAREA_LABELS_SET)
    ? Data.TEXTAREA_LABELS_SET
    : Array.isArray(Data.TextareaLabels)
    ? Data.TextareaLabels
    : [];

  // convert arrays -> Set (HOOK: useMemo) — dipanggil setiap render tapi urutannya tetap sama
  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  // build initialForm dari defaultData (untuk edit) — juga hook useMemo
  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    // LABEL_TO_KEY_RAW adalah map label -> key
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

  // jika modul belum selesai di-load, tampilkan loading overlay (HOOKS tetap sudah dipanggil)
  if (loadingModule) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 bg-white rounded-lg p-6 shadow">
          <div className="font-semibold mb-2">Memuat form…</div>
          <div className="text-sm text-gray-600">Tunggu sebentar.</div>
          <div className="mt-4 text-right">
            <button onClick={onClose} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (moduleError || !dataModule) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative z-10 bg-white rounded-lg p-6 shadow max-w-lg">
          <h3 className="font-semibold mb-2">Error memuat form</h3>
          <p className="text-sm text-gray-600 mb-4">{moduleError?.message ?? "Data module tidak tersedia."}</p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // handle submit: normalisasi numeric fields lalu create/update
  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      if (typeof updateFinanceFromStore === "function") {
        return await updateFinanceFromStore(defaultData.risk_id, normalized);
      } else {
        const res = await fetch(`/api/RiskAssessment/finance/${defaultData.risk_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalized),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Update failed (${res.status})`);
        }
        return await res.json();
      }
    } else {
      if (typeof createFinance === "function") {
        return await createFinance(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/finance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalized),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Create failed (${res.status})`);
        }
        return await res.json();
      }
    }
  };

  return (
    <GenericInputModal
      onClose={onClose}
      onSubmit={handleSubmit}
      title={defaultData ? "Edit Finance" : "New Finance"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}

