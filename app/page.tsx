"use client";

import { FormEvent, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  downloadCsvExport,
  downloadZipExport,
  isImageFile,
  isVideoFile,
  mediaPublicUrl,
} from "@/lib/export";
import { cn } from "@/lib/utils";
import type { ScoredTaggedFile, SearchFilters, SearchResult } from "@/lib/search";

type PageState = "idle" | "loading" | "success" | "error";

function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.mood.length > 0 ||
    filters.dominant_colors.length > 0 ||
    filters.orientation.length > 0 ||
    filters.channels.length > 0 ||
    filters.keywords.length > 0 ||
    filters.has_text !== null ||
    filters.media_type !== null
  );
}

function ExtractedFilters({ filters }: { filters: SearchFilters }) {
  if (!hasActiveFilters(filters)) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm font-medium">
        Filtre detectate din cerere
      </p>
      <div className="flex flex-wrap gap-2">
        {filters.mood.map((mood) => (
          <Badge key={`mood-${mood}`} variant="secondary">
            mood: {mood}
          </Badge>
        ))}
        {filters.dominant_colors.map((color) => (
          <Badge key={`color-${color}`} variant="secondary">
            culoare: {color}
          </Badge>
        ))}
        {filters.orientation.map((orientation) => (
          <Badge key={`orientation-${orientation}`} variant="secondary">
            {orientation}
          </Badge>
        ))}
        {filters.channels.map((channel) => (
          <Badge key={`channel-${channel}`} variant="outline">
            {channel}
          </Badge>
        ))}
        {filters.has_text === true && (
          <Badge variant="secondary">cu text</Badge>
        )}
        {filters.has_text === false && (
          <Badge variant="secondary">fără text</Badge>
        )}
        {filters.media_type !== null && (
          <Badge variant="secondary">tip: {filters.media_type}</Badge>
        )}
        {filters.keywords.map((keyword) => (
          <Badge key={`keyword-${keyword}`} variant="outline">
            {keyword}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function MediaPreview({ filename }: { filename: string }) {
  const src = mediaPublicUrl(filename);

  if (isImageFile(filename)) {
    return (
      <img
        src={src}
        alt={filename}
        className="aspect-video w-full object-cover"
        loading="lazy"
        draggable={false}
      />
    );
  }

  if (isVideoFile(filename)) {
    return (
      <video
        src={src}
        controls
        className="aspect-video w-full bg-black object-contain"
        preload="metadata"
        onClick={(event) => event.stopPropagation()}
      />
    );
  }

  return (
    <div className="bg-muted text-muted-foreground flex aspect-video w-full items-center justify-center text-sm">
      Preview indisponibil
    </div>
  );
}

function ResultCard({
  file,
  selected,
  onToggle,
}: {
  file: ScoredTaggedFile;
  selected: boolean;
  onToggle: () => void;
}) {
  const subjects = file.tags.subjects.slice(0, 4);

  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden pt-0 transition-shadow",
        selected &&
          "ring-2 ring-primary shadow-md ring-offset-2 ring-offset-background"
      )}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${selected ? "Deselectează" : "Selectează"} ${file.filename}`}
    >
      <div className="relative">
        <MediaPreview filename={file.filename} />
        <div
          className={cn(
            "absolute top-2 left-2 flex size-5 items-center justify-center rounded border shadow-sm transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background/90 text-transparent"
          )}
          aria-hidden="true"
        >
          <Check className="size-3.5" />
        </div>
      </div>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-sm leading-snug">
            {file.filename}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 text-[0.65rem]">
            match: {file.score}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((subject) => (
            <Badge key={subject} variant="secondary" className="text-[0.65rem]">
              {subject}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-1.5 border-t-0 bg-transparent pt-0">
        {file.tags.mood.slice(0, 3).map((mood) => (
          <Badge key={mood} variant="outline" className="text-[0.65rem]">
            {mood}
          </Badge>
        ))}
        <Badge variant="outline" className="text-[0.65rem]">
          {file.tags.orientation}
        </Badge>
      </CardFooter>
    </Card>
  );
}

function SelectionBar({
  count,
  isPreparingZip,
  exportMessage,
  onDeselectAll,
  onDownloadZip,
  onExportCsv,
}: {
  count: number;
  isPreparingZip: boolean;
  exportMessage: string | null;
  onDeselectAll: () => void;
  onDownloadZip: () => void;
  onExportCsv: () => void;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <div className="sticky bottom-4 z-20 space-y-2">
      <div className="border-border bg-background/95 flex flex-col gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          {count} {count === 1 ? "selectat" : "selectate"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="outline" size="sm" onClick={onDeselectAll}>
            Deselectează tot
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={isPreparingZip}
          >
            Exportă lista (CSV)
          </Button>
          <Button size="sm" onClick={onDownloadZip} disabled={isPreparingZip}>
            {isPreparingZip ? (
              <>
                <Loader2 className="animate-spin" />
                Se pregătește...
              </>
            ) : (
              "Descarcă selecția (ZIP)"
            )}
          </Button>
        </div>
      </div>
      {exportMessage && (
        <p className="text-muted-foreground text-center text-xs sm:text-sm">
          {exportMessage}
        </p>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="overflow-hidden pt-0">
          <div className="bg-muted aspect-video w-full animate-pulse" />
          <CardHeader className="gap-3">
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="bg-muted h-5 w-16 animate-pulse rounded-full" />
              <div className="bg-muted h-5 w-20 animate-pulse rounded-full" />
              <div className="bg-muted h-5 w-14 animate-pulse rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<
    Map<string, ScoredTaggedFile>
  >(new Map());
  const [isPreparingZip, setIsPreparingZip] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const selectedList = Array.from(selectedFiles.values());
  const selectedCount = selectedFiles.size;

  function toggleSelection(file: ScoredTaggedFile) {
    setExportMessage(null);
    setSelectedFiles((previous) => {
      const next = new Map(previous);
      if (next.has(file.filename)) {
        next.delete(file.filename);
      } else {
        next.set(file.filename, file);
      }
      return next;
    });
  }

  function deselectAll() {
    setExportMessage(null);
    setSelectedFiles(new Map());
  }

  function handleExportCsv() {
    setExportMessage(null);
    downloadCsvExport(selectedList);
  }

  async function handleDownloadZip() {
    setExportMessage(null);
    setIsPreparingZip(true);

    try {
      const { added, skipped } = await downloadZipExport(selectedList);
      if (skipped > 0) {
        setExportMessage(
          `Arhiva conține ${added} fișiere. ${skipped} fișiere au fost omise.`
        );
      }
    } catch (error) {
      setExportMessage(
        error instanceof Error
          ? error.message
          : "Descărcarea ZIP a eșuat. Încearcă din nou."
      );
    } finally {
      setIsPreparingZip(false);
    }
  }

  async function handleSearch(event?: FormEvent) {
    event?.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    setPageState("loading");
    setErrorMessage(null);
    setExportMessage(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      const data = (await response.json()) as SearchResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Căutarea a eșuat. Încearcă din nou.");
      }

      setResult(data);
      setPageState("success");
    } catch (error) {
      setResult(null);
      setPageState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare neașteptată. Încearcă din nou."
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 pb-24 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div className="space-y-3 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Media Browser
          </h1>
          <p className="text-muted-foreground mx-auto max-w-md text-base sm:text-lg">
            Caută și explorează fișierele media după tag-uri, tip sau nume.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
        >
          <Input
            type="search"
            placeholder="Caută în limbaj natural..."
            className="h-11 flex-1 text-base"
            aria-label="Căutare media"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={pageState === "loading"}
          />
          <Button
            type="submit"
            size="lg"
            className="h-11 shrink-0 px-8 sm:w-auto"
            disabled={pageState === "loading" || !query.trim()}
          >
            {pageState === "loading" ? (
              <>
                <Loader2 className="animate-spin" />
                Se caută...
              </>
            ) : (
              "Search"
            )}
          </Button>
        </form>
      </div>

      <div className="mx-auto mt-10 w-full space-y-8">
        {pageState === "idle" && (
          <p className="text-muted-foreground text-center text-sm sm:text-base">
            Caută în limbaj natural:{" "}
            <span className="text-foreground font-medium">
              &ldquo;energetic outdoor shots, no text&rdquo;
            </span>
          </p>
        )}

        {pageState === "loading" && (
          <div className="space-y-6">
            <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Interpretăm cererea și căutăm fișiere potrivite...
            </div>
            <LoadingSkeleton />
          </div>
        )}

        {pageState === "error" && errorMessage && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive mx-auto max-w-xl rounded-xl border px-4 py-3 text-center text-sm"
          >
            {errorMessage}
          </div>
        )}

        {pageState === "success" && result && (
          <div className="space-y-6">
            <ExtractedFilters filters={result.filters} />

            {result.total === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm sm:text-base">
                Niciun rezultat. Încearcă alți termeni.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  {result.total}{" "}
                  {result.total === 1 ? "rezultat găsit" : "rezultate găsite"}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.files.map((file) => (
                    <ResultCard
                      key={file.filename}
                      file={file}
                      selected={selectedFiles.has(file.filename)}
                      onToggle={() => toggleSelection(file)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <SelectionBar
        count={selectedCount}
        isPreparingZip={isPreparingZip}
        exportMessage={exportMessage}
        onDeselectAll={deselectAll}
        onDownloadZip={handleDownloadZip}
        onExportCsv={handleExportCsv}
      />
    </div>
  );
}
