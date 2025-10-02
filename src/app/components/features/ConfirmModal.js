"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function ConfirmModal({ 
  title = "Confirm", 
  message, 
  onClose, 
  onConfirm 
}) {
  const ref = useRef();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" }
      );
    }
  }, []);

  const shake = () => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { x: -6 },
        { x: 6, duration: 0.06, repeat: 3, yoyo: true, ease: "power1.inOut" }
      );
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm?.(); 
      onClose(); 
    } catch (err) {
      console.error("ConfirmModal error:", err);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <div 
        ref={ref} 
        className="relative z-10 w-full max-w-md bg-white rounded-lg shadow-lg p-6"
      >
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
