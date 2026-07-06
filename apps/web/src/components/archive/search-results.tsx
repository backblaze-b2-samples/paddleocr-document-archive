"use client";

import Link from "next/link";
import { Loader2, SearchX } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { useSearch } from "@/lib/queries";
import { formatConfidence } from "@/lib/utils";

export function SearchResults({ query }: { query: string }) {
  const { data: hits = [], isLoading, isFetching, error, refetch } = useSearch(query);

  if (!query.trim()) return null;

  return (
    <div className="rounded-md border border-border bg-muted/20">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Search results for &ldquo;{query}&rdquo;
        </p>
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} className="px-4" />
      ) : isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Searching…</p>
      ) : hits.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <SearchX className="h-4 w-4" />
          No documents match that text yet. Only processed documents are searchable.
        </div>
      ) : (
        <ul className="max-h-72 divide-y divide-border overflow-auto">
          {hits.map((hit) => (
            <li key={hit.doc_id}>
              <Link
                href={`/archive/${encodeURIComponent(hit.doc_id)}`}
                className="block px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{hit.doc_id}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {hit.collection} · {formatConfidence(hit.confidence)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {hit.snippet}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
