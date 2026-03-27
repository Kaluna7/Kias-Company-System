"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SELECT_OPTIONS as SELECT_OPTIONS_RAW, OPTIONAL_FIELDS as OPTIONAL_FIELDS_RAW } from "../../data/riskAssessmentConfig";

const SELECT_OPTIONS = SELECT_OPTIONS_RAW || {};
const OPTIONAL_FIELDS = new Set(Array.isArray(OPTIONAL_FIELDS_RAW) ? OPTIONAL_FIELDS_RAW : []);

const LARGE_TEXTAREA_LABELS = new Set([
  "risk description",
  "risk details",
  "impact description",
  "mitigation strategy",
]);

export function GenericInputModal({
  onClose,
  onSubmit,
  title = "New Data",
  listForm = [],
  labelToKey = {},
  numericFields = new Set(),
  textareaLabels = new Set(),
  initialForm = null,
}) {
  const emptyForm = useMemo(() => {
    const obj = {};
    Object.values(labelToKey || {}).forEach((k) => {
      obj[k] = "";
    });
    return obj;
  }, [labelToKey]);

  const [form, setForm] = useState(() => (initialForm ? { ...initialForm } : { ...emptyForm }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sopRelatedChoice, setSopRelatedChoice] = useState(
    String(initialForm?.sop_related ?? "").trim() ? "yes" : "no"
  );

  useEffect(() => {
    setForm(initialForm ? { ...initialForm } : { ...emptyForm });
  }, [initialForm, emptyForm]);

  useEffect(() => {
    setSopRelatedChoice(String((initialForm ? initialForm.sop_related : emptyForm.sop_related) ?? "").trim() ? "yes" : "no");
  }, [initialForm, emptyForm]);

  const onChange = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = { ...form };
      for (const nf of numericFields) {
        if (Object.prototype.hasOwnProperty.call(payload, nf)) {
          payload[nf] = payload[nf] === "" ? null : Number(payload[nf]);
        }
      }
      await onSubmit(payload);
      setLoading(false);
      if (!initialForm) setForm({ ...emptyForm });
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err?.message ?? "Gagal menyimpan data");
    }
  };

  const isLargeTextarea = (label) => {
    if (!label) return false;
    const l = String(label).trim().toLowerCase();
    if (LARGE_TEXTAREA_LABELS.has(l)) return true;
    if (textareaLabels && textareaLabels.has(label)) return true;
    if (textareaLabels && Array.from(textareaLabels).some(x => String(x).toLowerCase() === l)) return true;
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-[#0F1730] shadow-xl ring-1 ring-white/10 md:h-auto md:max-h-[90dvh] md:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
          <h2 className="text-white text-base font-semibold leading-tight sm:text-lg md:text-2xl">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-2 text-2xl leading-none text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col px-3 py-3 md:px-6 md:py-6">
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-gray-50 p-2 md:p-3">
            <div className="md:pr-2" style={{ scrollbarGutter: "stable" }}>
              <div className="grid grid-cols-1 gap-3 p-2 md:grid-cols-4 md:gap-4 md:p-4">
                {Array.isArray(listForm) && listForm.length > 0 ? (
                  listForm.map((item, idx) => {
                    const label = item.label;
                    const key = labelToKey?.[label];
                    if (!key) return null;

                    const largeTA = isLargeTextarea(label);
                    const isTextarea = largeTA || textareaLabels?.has(label);
                    const isNumber = numericFields?.has(key);
                    const hasSelect = Array.isArray(SELECT_OPTIONS?.[key]);
                    const isSopRelatedField = key === "sop_related";

                    if (isTextarea) {
                      // gunakan ukuran lebih besar jika label termasuk LARGE_TEXTAREA_LABELS
                      const minH = largeTA ? "min-h-[10rem]" : "min-h-[6rem]";
                      const maxH = largeTA ? "max-h-[24rem]" : "max-h-[16rem]";

                      return (
                        <div key={idx} className="md:col-span-4">
                          <label className="block mb-2 text-sm font-medium text-gray-700">
                            {label}
                          </label>
                          <textarea
                            value={form[key] ?? ""}
                            onChange={(e) => onChange(key, e.target.value)}
                            placeholder={item.placeholder ?? ""}
                            className={`w-full rounded border border-gray-300 bg-white p-3 text-sm resize-y ${minH} ${maxH} focus:outline-none focus:ring-2 focus:ring-indigo-400`}
                          />
                        </div>
                      );
                    }

                    return (
                      <React.Fragment key={idx}>
                        <div className="flex items-start md:col-span-1 md:items-center">
                          <label className="text-sm font-medium text-gray-700">
                            {label}
                            {!OPTIONAL_FIELDS.has(key) && !isSopRelatedField && <span className="text-red-500 ml-1">*</span>}
                          </label>
                        </div>

                        <div className="min-w-0 md:col-span-3">
                          {isSopRelatedField ? (
                            <div className="space-y-2">
                              <select
                                value={sopRelatedChoice}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setSopRelatedChoice(nextValue);
                                  if (nextValue === "no") {
                                    onChange(key, "");
                                  }
                                }}
                                className="h-11 w-full rounded border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                              </select>

                              {sopRelatedChoice === "yes" ? (
                                <input
                                  value={form[key] ?? ""}
                                  onChange={(e) => onChange(key, e.target.value)}
                                  placeholder="Input SOP Related / Standard"
                                  type="text"
                                  className="h-11 w-full rounded border border-gray-300 bg-white px-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                              ) : null}
                            </div>
                          ) : hasSelect ? (
                            <select
                              value={form[key] ?? ""}
                              onChange={(e) => onChange(key, e.target.value)}
                              className="h-11 w-full rounded border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              required={!OPTIONAL_FIELDS.has(key)}
                            >
                              <option value="">{item.placeholder ?? "Pilih..."}</option>
                              {SELECT_OPTIONS[key].map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={form[key] ?? ""}
                              onChange={(e) => onChange(key, e.target.value)}
                              placeholder={item.placeholder ?? ""}
                              type={isNumber ? "number" : "text"}
                              min={isNumber ? 0 : undefined}
                              required={!OPTIONAL_FIELDS.has(key)}
                              onWheel={isNumber ? (e) => e.currentTarget.blur() : undefined}
                              className="h-11 w-full rounded border border-gray-300 bg-white px-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <div className="col-span-4 text-sm text-gray-600">
                    Tidak ada form terdefinisi. Periksa konfigurasi `listForm` dan `labelToKey`.
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>
          )}

          <div className="mt-4 flex flex-col-reverse items-stretch justify-end gap-2 border-t border-white/10 bg-[#0F1730] pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] md:flex-row md:items-center md:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-gray-200 px-4 py-3 text-gray-800 hover:bg-gray-300 md:w-auto md:py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg px-4 py-3 text-white md:w-auto md:py-2 ${loading ? "bg-green-300" : "bg-green-600 hover:bg-green-700"}`}
            >
              {loading ? "Saving..." : (initialForm ? "Update" : "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
