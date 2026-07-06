import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@paddleocr-document-archive/shared";

export function StatusBadge({
  status,
  processing = false,
}: {
  status: DocumentStatus;
  processing?: boolean;
}) {
  // An in-flight OCR run has no persisted status of its own; the Run-OCR
  // mutation's pending state drives this distinct "Processing" badge so the row
  // never keeps reading a misleading "Pending" while the engine is working.
  if (processing) {
    return (
      <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </Badge>
    );
  }
  if (status === "processed") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        Processed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      Pending
    </Badge>
  );
}
