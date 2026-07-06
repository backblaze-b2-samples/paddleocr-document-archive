"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2, Pencil, ScanText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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
import { StatusBadge } from "@/components/documents/status-badge";
import { EditDocumentDialog } from "@/components/documents/edit-document-dialog";
import { ApiError } from "@/lib/api-client";
import { useDeleteDocument, useDocument, useRunOcr } from "@/lib/queries";
import { formatConfidence } from "@/lib/utils";

function ImagePane({ label, src, alt }: { label: string; src: string | null; alt: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="relative h-[min(60svh,460px)] min-h-[240px] w-full overflow-hidden rounded-md border border-border bg-muted/30">
        {src ? (
          <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 100vw, 480px" className="object-contain" unoptimized />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            Not available yet
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentDetail({ docId }: { docId: string }) {
  const router = useRouter();
  const { data: doc, isLoading, error, refetch } = useDocument(docId);
  const runMutation = useRunOcr();
  const deleteMutation = useDeleteDocument();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }
  if (error) {
    return <ErrorState error={error} title="Couldn't load document" onRetry={() => refetch()} />;
  }
  if (!doc) {
    return (
      <EmptyState icon={ScanText} title="Document not found" description="It may have been deleted." />
    );
  }

  const handleRun = () =>
    runMutation.mutate(doc.doc_id, {
      onSuccess: (detail) => toast.success(`OCR complete (${detail.regions.length} regions)`),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "OCR run failed"),
    });

  const handleDelete = () =>
    deleteMutation.mutate(doc.doc_id, {
      onSuccess: () => {
        toast.success(`${doc.filename} deleted`);
        router.push("/archive");
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Delete failed"),
      onSettled: () => setConfirmDelete(false),
    });

  return (
    <div className="space-y-6">
      <div className="animate-fade-in space-y-3 border-b border-border pb-5">
        <Link
          href="/archive"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to archive
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="page-title break-all">{doc.filename}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <StatusBadge status={doc.status} />
              <span>Collection: {doc.collection}</span>
              <span>Language: {doc.lang}</span>
              <span>Confidence: {formatConfidence(doc.confidence)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" className="h-8" disabled={runMutation.isPending} onClick={handleRun}>
              {runMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ScanText className="h-3.5 w-3.5" />
              )}
              {doc.status === "processed" ? "Re-run OCR" : "Run OCR"}
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ImagePane label="Scan" src={doc.scan_url} alt={`Scan of ${doc.filename}`} />
        <ImagePane
          label="Detection overlay"
          src={doc.overlay_url}
          alt={`OCR overlay for ${doc.filename}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Recognized text</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {doc.status !== "processed" ? (
              <p className="text-sm text-muted-foreground">
                Run OCR to recognize text for this scan.
              </p>
            ) : doc.text.trim() ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
                {doc.text}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                No text was detected on this page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">
              Regions {doc.regions.length > 0 && `(${doc.regions.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {doc.regions.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                No detected regions yet.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-border overflow-auto">
                {doc.regions.map((region, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-5 py-2.5">
                    <span className="text-sm [overflow-wrap:anywhere]">{region.text}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {formatConfidence(region.confidence)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <EditDocumentDialog
        document={doc}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              This permanently deletes the scan and every OCR artifact for{" "}
              <strong className="break-all font-semibold text-foreground">{doc.filename}</strong>{" "}
              from Backblaze B2. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
