"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  deleteDocument,
  deleteFile,
  editDocument,
  getArchiveStats,
  getDocument,
  getDocuments,
  getFiles,
  getFileStats,
  getPreviewUrl,
  getProcessingActivity,
  getUploadActivity,
  ingestDocument,
  reindexDocuments,
  runOcr,
  searchDocuments,
} from "@/lib/api-client";
import type {
  DocumentRecord,
  FileMetadata,
  OcrConfig,
  SearchHit,
} from "@paddleocr-document-archive/shared";

// Single source of truth for query keys. Keep these tightly scoped so that
// invalidating "files" doesn't blow away unrelated caches, and so an IDE
// "find usages" of `qk.files` reveals every consumer.
export const qk = {
  all: ["b2"] as const,
  files: (prefix?: string, limit?: number) =>
    [...qk.all, "files", prefix ?? "", limit ?? 100] as const,
  stats: () => [...qk.all, "stats"] as const,
  uploadActivity: (days: number) =>
    [...qk.all, "stats", "activity", days] as const,
  preview: (key: string) => [...qk.all, "preview", key] as const,
  documents: () => [...qk.all, "documents"] as const,
  document: (docId: string) => [...qk.all, "documents", docId] as const,
  archiveStats: () => [...qk.all, "archive-stats"] as const,
  processingActivity: (days: number) =>
    [...qk.all, "archive-stats", "activity", days] as const,
  search: (query: string) => [...qk.all, "search", query] as const,
};

export function useFiles(prefix = "", limit = 100) {
  return useQuery<FileMetadata[], ApiError>({
    queryKey: qk.files(prefix, limit),
    queryFn: () => getFiles(prefix, limit),
  });
}

export function useFileStats() {
  return useQuery({
    queryKey: qk.stats(),
    queryFn: getFileStats,
  });
}

export function useUploadActivity(days = 7) {
  return useQuery({
    queryKey: qk.uploadActivity(days),
    queryFn: () => getUploadActivity(days),
  });
}

// Presigned preview URL — only fetched when `enabled` is true (e.g., when
// the dialog opens for a specific file). Kept short-lived (60s) because
// the URL itself has a presigned expiry and is cheap to regenerate.
export function usePreviewUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.preview(key ?? ""),
    queryFn: () => getPreviewUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileKey: string) => deleteFile(fileKey),
    // After delete, blow away every cached file list + stats. Cheap and
    // correct — the dashboard re-fetches lazily as components remount.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}

// --- Document archive (OCR) ---

export function useDocuments() {
  return useQuery<DocumentRecord[], ApiError>({
    queryKey: qk.documents(),
    queryFn: getDocuments,
  });
}

export function useDocument(docId: string | undefined) {
  return useQuery({
    queryKey: qk.document(docId ?? ""),
    queryFn: () => getDocument(docId as string),
    enabled: !!docId,
  });
}

export function useArchiveStats() {
  return useQuery({
    queryKey: qk.archiveStats(),
    queryFn: getArchiveStats,
  });
}

export function useProcessingActivity(days = 7) {
  return useQuery({
    queryKey: qk.processingActivity(days),
    queryFn: () => getProcessingActivity(days),
  });
}

export function useSearch(query: string) {
  return useQuery<SearchHit[], ApiError>({
    queryKey: qk.search(query),
    queryFn: () => searchDocuments(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}

export function useIngestDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      file: File;
      config: OcrConfig;
      onProgress?: (percent: number) => void;
    }) => ingestDocument(args.file, args.config, args.onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}

export function useRunOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => runOcr(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}

export function useEditDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { docId: string; config: OcrConfig }) =>
      editDocument(args.docId, args.config),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => deleteDocument(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}

export function useReindex() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => reindexDocuments(),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}
