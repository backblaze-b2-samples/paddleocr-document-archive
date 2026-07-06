import Link from "next/link";
import { ScanText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArchiveExplorer } from "@/components/archive/archive-explorer";
import { ReindexButton } from "@/components/archive/reindex-button";

export default function ArchivePage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <h1 className="page-title">Archive</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            Your scanned documents on Backblaze B2. Run OCR, search recognized
            text, and manage each page. The search index rebuilds entirely from
            the B2-resident artifacts.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ReindexButton />
          <Button asChild size="sm" className="h-8">
            <Link href="/upload">
              <ScanText className="h-3.5 w-3.5" />
              Ingest scans
            </Link>
          </Button>
        </div>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <ArchiveExplorer />
      </div>
    </div>
  );
}
