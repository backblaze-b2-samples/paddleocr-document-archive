"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useDocuments } from "@/lib/queries";
import { formatConfidence, formatDate } from "@/lib/utils";

export function RecentRuns() {
  const { data: documents = [], isLoading, error, refetch } = useDocuments();

  const processed = documents
    .filter((d) => d.status === "processed" && d.processed_at)
    .sort((a, b) => (b.processed_at ?? "").localeCompare(a.processed_at ?? ""))
    .slice(0, 10);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent OCR Runs</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/archive"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View archive
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : processed.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No processed documents yet"
            description="Ingest scans and run OCR to see recent runs here."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[36%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Document
                </TableHead>
                <TableHead className="w-[20%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Collection
                </TableHead>
                <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confidence
                </TableHead>
                <TableHead className="w-[30%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Processed
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processed.map((doc) => (
                <TableRow key={doc.doc_id} className="table-row-hover">
                  <TableCell className="font-medium">
                    <Link
                      href={`/archive/${encodeURIComponent(doc.doc_id)}`}
                      className="truncate block hover:underline"
                    >
                      {doc.filename}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate">
                    {doc.collection}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatConfidence(doc.confidence)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {doc.processed_at ? formatDate(doc.processed_at) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
