"use client";

import { DatabaseZap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { useReindex } from "@/lib/queries";

export function ReindexButton() {
  const reindex = useReindex();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      disabled={reindex.isPending}
      onClick={() =>
        reindex.mutate(undefined, {
          onSuccess: (res) =>
            toast.success(`Search index rebuilt from B2 (${res.reindexed} documents)`),
          onError: (err) =>
            toast.error(err instanceof ApiError ? err.message : "Reindex failed"),
        })
      }
    >
      {reindex.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <DatabaseZap className="h-3.5 w-3.5" />
      )}
      Reindex
    </Button>
  );
}
