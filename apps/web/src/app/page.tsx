import Link from "next/link";
import { ScanText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArchiveStats } from "@/components/dashboard/archive-stats";
import { RecentRuns } from "@/components/dashboard/recent-runs";
import { ProcessingChart } from "@/components/dashboard/processing-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            OCR archive overview — documents ingested, pages recognized, and
            recognition confidence, all backed by Backblaze B2.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/upload">
            <ScanText className="h-3.5 w-3.5" />
            Ingest scans
          </Link>
        </Button>
      </div>
      <ArchiveStats />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-3">
          <ProcessingChart />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <RecentRuns />
        </div>
      </div>
    </div>
  );
}
