"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { Suspense } from "react";
import HarmonyLanding from "@/components/home/harmony-landing";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <HarmonyLanding />
        </Suspense>
      </main>
    </div>
  );
}
