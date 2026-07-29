"use client";

import React, { Suspense } from "react";
import { SwapPanel } from "@/components/SwapPanel";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function SwapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0f0815] to-[#0a0a0f] px-4 py-8">
      <Suspense fallback={<LoadingSpinner />}>
        <SwapPanel />
      </Suspense>
    </div>
  );
}
