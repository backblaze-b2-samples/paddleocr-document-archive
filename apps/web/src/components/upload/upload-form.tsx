"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Library } from "lucide-react";
import type { FileRejection } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Dropzone } from "./dropzone";
import { UploadProgress, type UploadItem } from "./upload-progress";
import { ingestDocument } from "@/lib/api-client";
import { humanizeBytes } from "@/lib/utils";
import { useRefresh } from "@/lib/refresh-context";
import { OCR_LANGUAGES } from "@paddleocr-document-archive/shared";

const MAX_TOAST_FILE_NAME_LENGTH = 80;

const ingestSchema = z.object({
  lang: z.string(),
  detectOrientation: z.boolean(),
  collection: z.string().max(80, "Collection must be 80 characters or fewer"),
});

type IngestValues = z.infer<typeof ingestSchema>;

const defaultValues: IngestValues = {
  lang: "en",
  detectOrientation: true,
  collection: "",
};

function createUploadItem(file: File): UploadItem {
  return {
    id: `${file.name}-${file.lastModified}-${Date.now()}-${Math.random()}`,
    file,
    progress: 0,
    retryable: true,
    status: "uploading",
  };
}

function formatToastFileName(name: string) {
  if (name.length <= MAX_TOAST_FILE_NAME_LENGTH) return name;
  const sliceLength = Math.floor((MAX_TOAST_FILE_NAME_LENGTH - 3) / 2);
  return `${name.slice(0, sliceLength)}...${name.slice(-sliceLength)}`;
}

export function UploadForm() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const { triggerRefresh } = useRefresh();

  const form = useForm<IngestValues>({
    resolver: zodResolver(ingestSchema),
    defaultValues,
  });

  const ingestItems = useCallback(
    async (queue: UploadItem[]) => {
      if (queue.length === 0) return;
      const values = form.getValues();
      const config = {
        lang: values.lang,
        detect_orientation: values.detectOrientation,
        collection: values.collection.trim() || "general",
      };

      setIngesting(true);
      let anySuccess = false;
      try {
        for (const item of queue) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, error: undefined, progress: 0, retryable: true, status: "uploading" }
                : i
            )
          );
          try {
            await ingestDocument(item.file, config, (percent) => {
              setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i))
              );
            });
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, status: "complete", progress: 100 } : i
              )
            );
            toast.success(`${formatToastFileName(item.file.name)} ingested`);
            anySuccess = true;
          } catch (err) {
            const message = err instanceof Error ? err.message : "Ingest failed";
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, status: "error", error: message, retryable: true }
                  : i
              )
            );
            toast.error(`Failed to ingest ${formatToastFileName(item.file.name)}: ${message}`);
          }
        }
      } finally {
        setIngesting(false);
        if (anySuccess) triggerRefresh();
      }
    },
    [form, triggerRefresh]
  );

  const handleFilesRejected = useCallback((rejections: FileRejection[]) => {
    for (const rejection of rejections) {
      const errors = rejection.errors.map((e) =>
        e.code === "file-too-large"
          ? `exceeds 100MB limit (${humanizeBytes(rejection.file.size)})`
          : e.message
      );
      toast.error(`${formatToastFileName(rejection.file.name)}: ${errors.join(", ")}`);
    }
  }, []);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (ingesting) {
        toast.info("Wait for the current ingest queue to finish first.");
        return;
      }
      const newItems = files.map(createUploadItem);
      setItems((prev) => [...prev, ...newItems]);
      void ingestItems(newItems);
    },
    [ingestItems, ingesting]
  );

  const retryUpload = useCallback(
    (id: string) => {
      if (ingesting) return;
      const item = items.find((i) => i.id === id);
      if (!item || item.retryable === false) return;
      void ingestItems([item]);
    },
    [items, ingestItems, ingesting]
  );

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === "uploading"));
  }, []);

  const hasCompleted = items.some(
    (i) => i.status === "complete" || i.status === "error"
  );
  const hasSuccess = items.some((i) => i.status === "complete");

  return (
    <Form {...form}>
      <div className="space-y-6">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">OCR configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-6">
            <FormField
              control={form.control}
              name="lang"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OCR language</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-60">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OCR_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Leave language on English and orientation on for typical
                    latin-script scans — a sound first run.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="detectOrientation"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Detect page orientation</FormLabel>
                    <FormDescription>
                      Runs angle classification so rotated pages are read
                      correctly. Keep on unless your scans are perfectly upright.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="collection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source collection</FormLabel>
                  <FormControl>
                    <Input placeholder="general" className="w-60" {...field} />
                  </FormControl>
                  <FormDescription>
                    A free-form label to group related scans (e.g. a case number
                    or box ID). Defaults to &quot;general&quot; when left blank.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Add scans</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <Dropzone
              onFilesSelected={handleFilesSelected}
              onFilesRejected={handleFilesRejected}
              disabled={ingesting}
            />
            <UploadProgress disabled={ingesting} items={items} onRetry={retryUpload} />
            {hasCompleted && !ingesting && (
              <div className="flex justify-end gap-2">
                {hasSuccess && (
                  <Button asChild size="sm">
                    <Link href="/archive">
                      <Library className="h-3.5 w-3.5" />
                      View in Archive
                    </Link>
                  </Button>
                )}
                <Button
                  aria-label="Clear finished ingests"
                  variant="outline"
                  size="sm"
                  onClick={clearCompleted}
                >
                  Clear finished
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Form>
  );
}
