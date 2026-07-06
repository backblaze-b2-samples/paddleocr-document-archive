import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@paddleocr-document-archive/shared";

export function StatusBadge({ status }: { status: DocumentStatus }) {
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
