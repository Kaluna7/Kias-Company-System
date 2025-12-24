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
    import("../../data/riskAssessmentConfig")
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



// ACCOUNTING INPUT POP UP

import { useAccountingStore } from "@/app/stores/RiskAssessement/accountingStore";

export function NewAccountingInput({ onClose, defaultData = null }) {
  const createAccounting = useAccountingStore((s) => s.createAccounting);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListAccounting)
    ? Data.ListAccounting
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_ACCOUNTING ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/accounting/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createAccounting === "function") {
        return await createAccounting(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/accounting", {
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
      title={defaultData ? "Edit Accounting" : "New Accounting"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}



// HRD INPUT POP UP

import { useHrdStore } from "@/app/stores/RiskAssessement/hrdStore";

export function NewHrdInput({ onClose, defaultData = null }) {
  const createHrd = useHrdStore((s) => s.createHrd);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListHrd)
    ? Data.ListHrd
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_HRD ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/hrd/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createHrd === "function") {
        return await createHrd(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/hrd", {
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
      title={defaultData ? "Edit HRD" : "New HRD"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}



// GENERAL AFFAIR POP UP

import { useGeneralAffairStore } from "@/app/stores/RiskAssessement/gaStore";

export function NewGeneralAffairInput({ onClose, defaultData = null }) {
  const createGeneralAffair = useGeneralAffairStore((s) => s.createGeneralAffair);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListGeneralAffair)
    ? Data.ListGeneralAffair
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_GENERAL_AFFAIR ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/g&a/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createGeneralAffair === "function") {
        return await createGeneralAffair(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/g&a", {
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
      title={defaultData ? "Edit G & A" : "New G & A"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}


// STORE DESIGN & PLANNING POP UP

import { useStorePlanningStore } from "@/app/stores/RiskAssessement/sdpStore";

export function NewSDPInput({ onClose, defaultData = null }) {
  const createStorePlanning = useStorePlanningStore((s) => s.createStorePlanning);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListSDP)
    ? Data.ListSDP
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_SDP ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/sdp/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createStorePlanning === "function") {
        return await createStorePlanning(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/sdp", {
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
      title={defaultData ? "Edit SDP" : "New SDP"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}


// TAX POP UP

import { useTaxStore } from "@/app/stores/RiskAssessement/taxStore";

export function NewTaxInput({ onClose, defaultData = null }) {
  const createTax = useTaxStore((s) => s.createTax);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListTax)
    ? Data.ListTax
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_TAX ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/tax/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createTax === "function") {
        return await createTax(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/tax", {
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
      title={defaultData ? "Edit Tax" : "New Tax"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}


// LOSS & PREVENTION POP UP

import { useLossPreventionStore } from "@/app/stores/RiskAssessement/lpStore";

export function NewLpInput({ onClose, defaultData = null }) {
  const createLossPrevention = useLossPreventionStore((s) => s.createLossPrevention);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListLp)
    ? Data.ListLp
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_LP ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/l&p/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createLossPrevention === "function") {
        return await createLossPrevention(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/l&p", {
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
      title={defaultData ? "Edit L&P" : "New L&P"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}


// MIS POP UP

import { useMisStore } from "@/app/stores/RiskAssessement/misStore";

export function NewMisInput({ onClose, defaultData = null }) {
  const createMis = useMisStore((s) => s.createMis);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListMis)
    ? Data.ListMis
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_MIS ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/mis/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createMis === "function") {
        return await createMis(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/mis", {
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
      title={defaultData ? "Edit MIS" : "New MIS"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}


// MERCHANDISE POP UP

import { useMerchandiseStore } from "@/app/stores/RiskAssessement/merchStore";

export function NewMerchandiseInput({ onClose, defaultData = null }) {
  const createMerchandise = useMerchandiseStore((s) => s.createMerchandise);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListMerchandise)
    ? Data.ListMerchandise
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_MERCHANDISE ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/merch/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createMerchandise === "function") {
        return await createMerchandise(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/merch", {
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
      title={defaultData ? "Edit Merchandise" : "New Merchandise"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}



// OPERATIONAL POP UP

import { useOperationalStore } from "@/app/stores/RiskAssessement/opsStore";

export function NewOperationalInput({ onClose, defaultData = null }) {
  const createOperational = useOperationalStore((s) => s.createOperational);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListOperational)
    ? Data.ListOperational
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_OPERATIONAL ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/ops/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createOperational === "function") {
        return await createOperational(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/ops", {
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
      title={defaultData ? "Edit Operational" : "New Operational"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}


// WAREHOUSE POP UP

import { useWarehouseStore } from "@/app/stores/RiskAssessement/whsStore";

export function NewWarehouseInput({ onClose, defaultData = null }) {
  const createWarehouse = useWarehouseStore((s) => s.createWarehouse);

  const [dataModule, setDataModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingModule(true);
    import("../../data/riskAssessmentConfig")
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

  const Data = dataModule || {};

  const LIST_FORM_RAW = Array.isArray(Data.ListAssessmentForm)
    ? Data.ListAssessmentForm
    : Array.isArray(Data.ListWarehouse)
    ? Data.ListWarehouse
    : Array.isArray(Data.List)
    ? Data.List
    : [];

  const LABEL_TO_KEY_RAW =
    Data.LABEL_TO_KEY ||
    Data.LABEL_TO_KEY_WAREHOUSE ||
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

  const numericFields = useMemo(() => new Set(NUMERIC_FIELDS_RAW || []), [NUMERIC_FIELDS_RAW]);
  const textareaLabels = useMemo(() => new Set(TEXTAREA_LABELS_RAW || []), [TEXTAREA_LABELS_RAW]);

  const initialForm = useMemo(() => {
    if (!defaultData) return null;
    const out = {};
    Object.keys(LABEL_TO_KEY_RAW || {}).forEach((label) => {
      const key = LABEL_TO_KEY_RAW[label];
      if (!key) return;
      out[key] = defaultData[key] ?? "";
    });
    return out;
  }, [defaultData, LABEL_TO_KEY_RAW]);

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

  const handleSubmit = async (payload) => {
    const normalized = { ...payload };
    for (const nf of numericFields) {
      if (Object.prototype.hasOwnProperty.call(normalized, nf)) {
        normalized[nf] = normalized[nf] === "" ? null : Number(normalized[nf]);
      }
    }

    if (defaultData && defaultData.risk_id) {
      const res = await fetch(`/api/RiskAssessment/whs/${defaultData.risk_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Update failed (${res.status})`);
      }
      return await res.json();
    } else {
      if (typeof createWarehouse === "function") {
        return await createWarehouse(normalized);
      } else {
        const res = await fetch("/api/RiskAssessment/whs", {
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
      title={defaultData ? "Edit Warehouse" : "New Warehouse"}
      listForm={LIST_FORM_RAW}
      labelToKey={LABEL_TO_KEY_RAW}
      numericFields={numericFields}
      textareaLabels={textareaLabels}
      initialForm={initialForm}
    />
  );
}
