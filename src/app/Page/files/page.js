"use client";

import { Suspense } from "react";
import FilesClient from "./_components/FilesClient";

export const dynamic = "force-dynamic";

export default function FilesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading...</div>}>
      <FilesClient />
    </Suspense>
  );
}
