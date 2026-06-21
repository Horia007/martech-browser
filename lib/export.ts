import JSZip from "jszip";

import type { ScoredTaggedFile } from "@/lib/search";

type MediaTypeLabel = "image" | "video" | "unknown";

function getMediaTypeLabel(filename: string): MediaTypeLabel {
  if (/\.(mov|mp4|webm)$/i.test(filename)) {
    return "video";
  }
  if (/\.(jpe?g|png|gif|webp)$/i.test(filename)) {
    return "image";
  }
  return "unknown";
}

export function mediaPublicUrl(filename: string): string {
  return `/media/${encodeURIComponent(filename)}`;
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(files: ScoredTaggedFile[]): string {
  const headers = [
    "filename",
    "type",
    "mood",
    "subjects",
    "channel_suitability",
    "has_text",
  ];

  const rows = files.map((file) =>
    [
      file.filename,
      getMediaTypeLabel(file.filename),
      file.tags.mood.join("; "),
      file.tags.subjects.join("; "),
      file.tags.channel_suitability.join("; "),
      String(file.tags.has_text),
    ]
      .map(escapeCsvValue)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvExport(files: ScoredTaggedFile[]): void {
  const csv = buildCsv(files);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `media-export-${Date.now()}.csv`);
}

interface ZipExportResult {
  added: number;
  skipped: number;
}

export async function downloadZipExport(
  files: ScoredTaggedFile[]
): Promise<ZipExportResult> {
  const zip = new JSZip();
  let added = 0;
  let skipped = 0;

  await Promise.all(
    files.map(async (file) => {
      try {
        const response = await fetch(mediaPublicUrl(file.filename));
        if (!response.ok) {
          throw new Error(`Nu s-a putut încărca ${file.filename}`);
        }
        const blob = await response.blob();
        zip.file(file.filename, blob);
        added += 1;
      } catch {
        skipped += 1;
      }
    })
  );

  if (added === 0) {
    throw new Error("Niciun fișier nu a putut fi adăugat în arhivă.");
  }

  const content = await zip.generateAsync({ type: "blob" });
  downloadBlob(content, `media-selection-${Date.now()}.zip`);

  return { added, skipped };
}

export function isImageFile(filename: string): boolean {
  return getMediaTypeLabel(filename) === "image";
}

export function isVideoFile(filename: string): boolean {
  return getMediaTypeLabel(filename) === "video";
}
