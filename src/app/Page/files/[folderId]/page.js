"use client";

import { Suspense } from "react";
import FilesFolderClient from "../_components/FilesFolderClient";

export const dynamic = "force-dynamic";

export default function FilesFolderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading...</div>}>
      <FilesFolderClient />
    </Suspense>
  );
}
