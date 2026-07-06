"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Eye,
  FileImage,
  Library,
  Loader2,
  Pencil,
  RefreshCw,
  ScanText,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/documents/status-badge";
import { EditDocumentDialog } from "@/components/documents/edit-document-dialog";
import { SearchResults } from "@/components/archive/search-results";
import { ApiError } from "@/lib/api-client";
import { useDeleteDocument, useDocuments, useRunOcr } from "@/lib/queries";
import { formatConfidence } from "@/lib/utils";
import type { DocumentRecord } from "@paddleocr-document-archive/shared";

export function ArchiveExplorer() {
  const { data: documents = [], isLoading, isFetching, error, refetch } = useDocuments();
  const runMutation = useRunOcr();
  const deleteMutation = useDeleteDocument();

  const [query, setQuery] = useState("");
  const [editTarget, setEditTarget] = useState<DocumentRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRun = (doc: DocumentRecord) => {
    setRunningId(doc.doc_id);
    runMutation.mutate(doc.doc_id, {
      onSuccess: (detail) =>
        toast.success(`OCR complete for ${doc.filename} (${detail.regions.length} regions)`),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "OCR run failed"),
      onSettled: () => setRunningId(null),
    });
  };

  const handleEdit = (doc: DocumentRecord) => {
    setEditTarget(doc);
    setEditOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteMutation.mutate(target.doc_id, {
      onSuccess: () => toast.success(`${target.filename} deleted`),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Delete failed"),
      onSettled: () => setDeleteTarget(null),
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 space-y-0">
          <CardTitle className="card-title">Archive</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-7 shrink-0 text-xs"
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recognized text across processed documents…"
              className="pl-9"
              aria-label="Search recognized text"
            />
          </div>
          <SearchResults query={query} />

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState error={error} title="Couldn't load documents" onRetry={() => refetch()} />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={Library}
              title="No documents yet"
              description="Ingest scanned pages to start building your searchable archive."
              action={
                <Button asChild size="sm">
                  <Link href="/upload">
                    <ScanText className="h-3.5 w-3.5" />
                    Ingest scans
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-14" />
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Document
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Collection
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Confidence
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const running = runningId === doc.doc_id && runMutation.isPending;
                  return (
                    <TableRow key={doc.doc_id} className="table-row-hover">
                      <TableCell>
                        <div className="relative h-10 w-10 overflow-hidden rounded border border-border bg-muted">
                          {doc.scan_url ? (
                            <Image
                              src={doc.scan_url}
                              alt={doc.filename}
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <FileImage className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <Link
                          href={`/archive/${encodeURIComponent(doc.doc_id)}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {doc.filename}
                        </Link>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {doc.doc_id}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{doc.collection}</TableCell>
                      <TableCell>
                        <StatusBadge status={doc.status} processing={running} />
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatConfidence(doc.confidence)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            disabled={running}
                            onClick={() => handleRun(doc)}
                          >
                            {running ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ScanText className="h-3.5 w-3.5" />
                            )}
                            {doc.status === "processed" ? "Re-run" : "Run OCR"}
                          </Button>
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label={`View ${doc.filename}`}>
                            <Link href={`/archive/${encodeURIComponent(doc.doc_id)}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Edit ${doc.filename}`}
                            onClick={() => handleEdit(doc)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label={`Delete ${doc.filename}`}
                            onClick={() => setDeleteTarget(doc)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditDocumentDialog document={editTarget} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              This permanently deletes the scan and every OCR artifact for{" "}
              <strong className="break-all font-semibold text-foreground">
                {deleteTarget?.filename}
              </strong>{" "}
              from Backblaze B2. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
