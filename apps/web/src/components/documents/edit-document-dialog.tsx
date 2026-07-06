"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useEditDocument } from "@/lib/queries";
import { OCR_LANGUAGES, type DocumentRecord } from "@paddleocr-document-archive/shared";

const schema = z.object({
  lang: z.string(),
  detectOrientation: z.boolean(),
  collection: z.string().max(80, "Collection must be 80 characters or fewer"),
});

type Values = z.infer<typeof schema>;

interface Props {
  document: DocumentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDocumentDialog({ document, open, onOpenChange }: Props) {
  const editMutation = useEditDocument();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { lang: "en", detectOrientation: true, collection: "" },
  });

  // Pre-fill from the selected document each time the dialog opens.
  useEffect(() => {
    if (document) {
      form.reset({
        lang: document.lang,
        detectOrientation: document.detect_orientation,
        collection: document.collection,
      });
    }
  }, [document, form]);

  const onSubmit = (values: Values) => {
    if (!document) return;
    editMutation.mutate(
      {
        docId: document.doc_id,
        config: {
          lang: values.lang,
          detect_orientation: values.detectOrientation,
          collection: values.collection.trim() || "general",
        },
      },
      {
        onSuccess: () => {
          toast.success("Document updated");
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Update failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
          <DialogDescription>
            Update the OCR config used the next time you run OCR on{" "}
            <span className="font-medium text-foreground">{document?.filename}</span>.
            This does not re-run OCR.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="lang"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OCR language</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
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
                      Angle classification for rotated pages.
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
                    <Input placeholder="general" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
