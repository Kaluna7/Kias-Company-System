"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import SopReviewDeptPage from "../_components/SopReviewDeptPage";

export default function LpSopReview() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <SopReviewDeptPage apiPath="l&p" departmentName="L & P" />
    </Suspense>
  );
}


