export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Document archive (OCR) ---

export type DocumentStatus = "pending" | "processed";

export interface OcrRegion {
  text: string;
  confidence: number;
  box: number[][];
}

export interface OcrConfig {
  lang: string;
  detect_orientation: boolean;
  collection: string;
}

export interface DocumentRecord {
  doc_id: string;
  filename: string;
  ext: string;
  collection: string;
  status: DocumentStatus;
  lang: string;
  detect_orientation: boolean;
  confidence: number | null;
  region_count: number | null;
  size_bytes: number;
  size_human: string;
  uploaded_at: string | null;
  processed_at: string | null;
  scan_url: string | null;
  overlay_url: string | null;
}

export interface DocumentDetail extends DocumentRecord {
  text: string;
  regions: OcrRegion[];
}

export interface SearchHit {
  doc_id: string;
  collection: string;
  confidence: number | null;
  snippet: string;
  updated_at: string | null;
}

export interface ArchiveStats {
  total_documents: number;
  processed: number;
  pending: number;
  pages_processed: number;
  avg_confidence: number | null;
  storage_bytes: number;
  storage_human: string;
}

export interface DailyProcessedCount {
  date: string;
  processed: number;
}

// Finite set of PaddleOCR language codes surfaced in the ingest/edit selectors.
export const OCR_LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ch", label: "Chinese" },
  { value: "fr", label: "French" },
  { value: "german", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "japan", label: "Japanese" },
  { value: "korean", label: "Korean" },
];
