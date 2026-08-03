"use client";

import { Suspense } from "react";
import DeskBoard from "@/components/DeskBoard";

export default function DeskPage() {
  return (
    <Suspense
      fallback={
        <main className="shell py-16 text-sm text-[var(--ink-soft)]">Loading desk…</main>
      }
    >
      <DeskBoard />
    </Suspense>
  );
}
