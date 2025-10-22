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

  useEffect(() => {
    setForm(initialForm ? { ...initialForm } : { ...emptyForm });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-5xl max-h-[85vh] bg-[#0F1730] rounded-2xl shadow-xl overflow-hidden ring-1 ring-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white text-xl md:text-2xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/80 hover:text-white rounded-md p-2 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6">
          <div className="bg-gray-50 p-3 rounded-lg h-[62vh] max-h-[62vh] overflow-y-auto">
            <div className="pr-2" style={{ scrollbarGutter: "stable" }}>
              <div className="grid grid-cols-4 gap-4 p-4">
                {Array.isArray(listForm) && listForm.length > 0 ? (
                  listForm.map((item, idx) => {
                    const label = item.label;
                    const key = labelToKey?.[label];
                    if (!key) return null;

                    const largeTA = isLargeTextarea(label);
                    const isTextarea = largeTA || textareaLabels?.has(label);
                    const isNumber = numericFields?.has(key);
                    const hasSelect = Array.isArray(SELECT_OPTIONS?.[key]);

                    if (isTextarea) {
                      // gunakan ukuran lebih besar jika label termasuk LARGE_TEXTAREA_LABELS
                      const minH = largeTA ? "min-h-[10rem]" : "min-h-[6rem]";
                      const maxH = largeTA ? "max-h-[24rem]" : "max-h-[16rem]";

                      return (
                        <div key={idx} className="col-span-4">
                          <label className="block mb-2 text-sm font-medium text-gray-700">
                            {label}
                          </label>
                          <textarea
                            value={form[key] ?? ""}
                            onChange={(e) => onChange(key, e.target.value)}
                            placeholder={item.placeholder ?? ""}
                            className={`w-full p-3 rounded resize-y ${minH} ${maxH} border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white`}
                          />
                        </div>
                      );
                    }

                    return (
                      <React.Fragment key={idx}>
                        <div className="col-span-1 flex items-center">
                          <label className="text-sm font-medium text-gray-700">
                            {label}
                            {!OPTIONAL_FIELDS.has(key) && <span className="text-red-500 ml-1">*</span>}
                          </label>
                        </div>

                        <div className="col-span-3">
                          {hasSelect ? (
                            <select
                              value={form[key] ?? ""}
                              onChange={(e) => onChange(key, e.target.value)}
                              className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
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
                              className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white appearance-none"
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

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-white ${loading ? "bg-green-300" : "bg-green-600 hover:bg-green-700"}`}
            >
              {loading ? "Saving..." : (initialForm ? "Update" : "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
