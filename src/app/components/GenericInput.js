"use client";
import React, { useState } from "react";
import { SELECT_OPTIONS, OPTIONAL_FIELDS } from "../data/Data";

export function GenericInputModal({
  onClose,
  createItem,      
  title = "New Data",
  listForm = [],     
  labelToKey = {},  
  numericFields = new Set(),
  textareaLabels = new Set()
}) {
  const initialForm = Object.values(labelToKey).reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = { ...form };
      for (const nf of numericFields) {
        payload[nf] = payload[nf] === "" ? null : Number(payload[nf]);
      }

      await createItem(payload);
      setLoading(false);
      setForm(initialForm);
      onClose();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan data");
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl max-h-[80vh] bg-[#0F1730] rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white text-2xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white rounded-md p-2 font-extrabold text-2xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6">
          <div className="bg-gray-50 p-2 h-[56vh] max-h-[56vh] overflow-y-auto">
            <div className="w-full h-full pr-2" style={{ scrollbarGutter: "stable" }}>
              <div className="grid grid-cols-4 gap-4 items-start p-4">
                {listForm.map((item, idx) => {
                  const label = item.label;
                  const key = labelToKey[label];
                  if (!key) return null;

                  const isTextarea = textareaLabels.has(label);
                  const isNumber = numericFields.has(key);
                  const hasSelect = !!SELECT_OPTIONS[key];

                  if (isTextarea) {
                    return (
                      <div key={idx} className="col-span-4">
                        <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>
                        <textarea
                          value={form[key]}
                          onChange={(e) => onChange(key, e.target.value)}
                          placeholder={item.placeholder}
                          className="w-full p-3 rounded resize-y min-h-[5rem] max-h-[14rem] border focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                    );
                  }

                  return (
                    <React.Fragment key={idx}>
                      <div className="col-span-1 flex items-center">
                        <label className="text-sm font-medium text-gray-700">{label}</label>
                      </div>

                      <div className="col-span-3">
                        {hasSelect ? (
                          <select
                            value={form[key]}
                            onChange={(e) => onChange(key, e.target.value)}
                            required
                            className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          >
                            {SELECT_OPTIONS[key].map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                          value={form[key]}
                          onChange={(e) => onChange(key, e.target.value)}
                          placeholder={item.placeholder}
                          type={isNumber ? "number" : "text"}
                          {...(isNumber ? { min: 0 } : {})}
                          required={!OPTIONAL_FIELDS.has(key)}
                          onWheel={isNumber ? (e) => e.currentTarget.blur() : undefined}
                          className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none"
                        />
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-2 text-sm text-red-500 bg-red-50 p-3 rounded">{error}</div>
          )}

          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 rounded-xl text-white ${loading ? "bg-green-300" : "bg-green-500 hover:bg-green-600 cursor-pointer"}`}
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
