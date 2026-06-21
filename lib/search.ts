import { readFileSync } from "fs";
import path from "path";

const ALLOWED_MOODS = [
  "energetic",
  "calm",
  "aspirational",
  "luxurious",
  "adventurous",
  "playful",
  "serious",
  "nostalgic",
  "romantic",
  "dramatic",
  "minimalist",
  "bold",
  "serene",
] as const;

const ALLOWED_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "beige",
  "black",
  "white",
  "gray",
  "gold",
  "silver",
] as const;

const ALLOWED_ORIENTATIONS = ["landscape", "portrait", "square"] as const;

const ALLOWED_CHANNELS = [
  "Instagram",
  "Instagram_Reels",
  "TikTok",
  "Facebook",
  "YouTube",
  "YouTube_Shorts",
  "Pinterest",
  "LinkedIn",
  "Snapchat",
  "paid_ads",
  "OOH",
  "email",
  "website",
] as const;

type Mood = (typeof ALLOWED_MOODS)[number];
type DominantColor = (typeof ALLOWED_COLORS)[number];
type Orientation = (typeof ALLOWED_ORIENTATIONS)[number];
type Channel = (typeof ALLOWED_CHANNELS)[number];

type MediaType = "video" | "image";

export interface SearchFilters {
  mood: Mood[];
  dominant_colors: DominantColor[];
  orientation: Orientation[];
  channels: Channel[];
  has_text: boolean | null;
  media_type: MediaType | null;
  keywords: string[];
}

interface FileTags {
  subjects: string[];
  scene: string;
  mood: string[];
  dominant_colors: string[];
  text_in_image: string;
  has_text: boolean;
  orientation: string;
  channel_suitability: string[];
}

interface TaggedFile {
  filename: string;
  status: string;
  tags: FileTags;
}

export interface ScoredTaggedFile extends TaggedFile {
  score: number;
}

interface TagsData {
  generated_at?: string;
  model?: string;
  files: TaggedFile[];
}

export interface SearchResult {
  filters: SearchFilters;
  files: ScoredTaggedFile[];
  total: number;
}

function loadTagsData(): TagsData {
  const filePath = path.join(process.cwd(), "data", "tags.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as TagsData;
}

function stripMarkdownJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }
  return trimmed;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function pickAllowed<T extends string>(
  values: unknown,
  allowed: readonly T[]
): T[] {
  if (!isStringArray(values)) {
    return [];
  }
  const allowedSet = new Set<string>(allowed);
  return [...new Set(values.filter((value) => allowedSet.has(value)))] as T[];
}

export function parseFiltersFromClaude(raw: string): SearchFilters {
  const jsonText = stripMarkdownJson(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Claude a returnat un JSON invalid.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Claude a returnat un format de filtre invalid.");
  }

  const record = parsed as Record<string, unknown>;

  let hasText: boolean | null = null;
  if (record.has_text === true || record.has_text === false) {
    hasText = record.has_text;
  } else if (record.has_text !== null && record.has_text !== undefined) {
    throw new Error("Valoarea has_text trebuie să fie true, false sau null.");
  }

  const keywords = isStringArray(record.keywords)
    ? record.keywords.map((keyword) => keyword.trim()).filter(Boolean)
    : [];

  let mediaType: MediaType | null = null;
  if (record.media_type === "video" || record.media_type === "image") {
    mediaType = record.media_type;
  } else if (record.media_type !== null && record.media_type !== undefined) {
    throw new Error("Valoarea media_type trebuie să fie 'video', 'image' sau null.");
  }

  return {
    mood: pickAllowed(record.mood, ALLOWED_MOODS),
    dominant_colors: pickAllowed(record.dominant_colors, ALLOWED_COLORS),
    orientation: pickAllowed(record.orientation, ALLOWED_ORIENTATIONS),
    channels: pickAllowed(record.channels, ALLOWED_CHANNELS),
    has_text: hasText,
    media_type: mediaType,
    keywords,
  };
}

const SCORE_KEYWORD_SPECIFIC = 4;
const SCORE_KEYWORD_SINGLE = 3;
const SCORE_FILENAME = 3;
const SCORE_MOOD = 2;
const SCORE_COLOR = 1;
const SCORE_CHANNEL = 1;

function getFileMediaType(filename: string): MediaType | null {
  if (/\.(mov|mp4|webm)$/i.test(filename)) {
    return "video";
  }
  if (/\.(jpe?g|png|gif|webp)$/i.test(filename)) {
    return "image";
  }
  return null;
}

function hasSoftFilters(filters: SearchFilters): boolean {
  return (
    filters.mood.length > 0 ||
    filters.dominant_colors.length > 0 ||
    filters.channels.length > 0 ||
    filters.keywords.length > 0
  );
}

function passesHardFilters(file: TaggedFile, filters: SearchFilters): boolean {
  if (file.status !== "success" || !file.tags) {
    return false;
  }

  if (filters.has_text !== null && file.tags.has_text !== filters.has_text) {
    return false;
  }

  if (
    filters.orientation.length > 0 &&
    !filters.orientation.includes(file.tags.orientation as Orientation)
  ) {
    return false;
  }

  if (filters.media_type !== null) {
    const fileMediaType = getFileMediaType(file.filename);
    if (fileMediaType !== filters.media_type) {
      return false;
    }
  }

  return true;
}

function keywordMatchesInContent(keyword: string, file: TaggedFile): boolean {
  const needle = keyword.toLowerCase();
  const scene = file.tags.scene.toLowerCase();
  if (scene.includes(needle)) {
    return true;
  }
  return file.tags.subjects.some((subject) =>
    subject.toLowerCase().includes(needle)
  );
}

function keywordMatchesInFilename(keyword: string, file: TaggedFile): boolean {
  return file.filename.toLowerCase().includes(keyword.toLowerCase());
}

function keywordMatches(keyword: string, file: TaggedFile): boolean {
  return (
    keywordMatchesInContent(keyword, file) ||
    keywordMatchesInFilename(keyword, file)
  );
}

function countArrayMatches(values: string[], requested: string[]): number {
  if (requested.length === 0) {
    return 0;
  }
  const valueSet = new Set(values);
  return requested.filter((item) => valueSet.has(item)).length;
}

function countKeywordMatches(file: TaggedFile, keywords: string[]): number {
  return keywords.filter((keyword) => keywordMatches(keyword, file)).length;
}

function isSpecificKeyword(keyword: string): boolean {
  const trimmed = keyword.trim();
  if (/\s/.test(trimmed)) {
    return true;
  }
  if (/[A-Z]/.test(trimmed)) {
    return true;
  }
  return false;
}

function getKeywordScore(keyword: string): number {
  return isSpecificKeyword(keyword)
    ? SCORE_KEYWORD_SPECIFIC
    : SCORE_KEYWORD_SINGLE;
}

function computeKeywordScore(file: TaggedFile, keywords: string[]): number {
  return keywords.reduce((total, keyword) => {
    let score = 0;
    if (keywordMatchesInContent(keyword, file)) {
      score += getKeywordScore(keyword);
    }
    if (keywordMatchesInFilename(keyword, file)) {
      score += SCORE_FILENAME;
    }
    return total + score;
  }, 0);
}

function computeRelevanceScore(
  file: TaggedFile,
  filters: SearchFilters
): number {
  const moodMatches = countArrayMatches(file.tags.mood, filters.mood);
  const colorMatches = countArrayMatches(
    file.tags.dominant_colors,
    filters.dominant_colors
  );
  const channelMatches = countArrayMatches(
    file.tags.channel_suitability,
    filters.channels
  );
  const keywordScore = computeKeywordScore(file, filters.keywords);

  return (
    keywordScore +
    moodMatches * SCORE_MOOD +
    colorMatches * SCORE_COLOR +
    channelMatches * SCORE_CHANNEL
  );
}

function passesSoftRelevanceGate(
  file: TaggedFile,
  filters: SearchFilters
): boolean {
  const hasKeywords = filters.keywords.length > 0;
  const hasMoodOrColors =
    filters.mood.length > 0 || filters.dominant_colors.length > 0;

  if (hasKeywords) {
    return countKeywordMatches(file, filters.keywords) > 0;
  }

  if (hasMoodOrColors) {
    const moodMatch = countArrayMatches(file.tags.mood, filters.mood) > 0;
    const colorMatch =
      countArrayMatches(file.tags.dominant_colors, filters.dominant_colors) > 0;
    return moodMatch || colorMatch;
  }

  if (filters.channels.length > 0) {
    return (
      countArrayMatches(file.tags.channel_suitability, filters.channels) > 0
    );
  }

  return true;
}

function filterFiles(
  data: TagsData,
  filters: SearchFilters
): ScoredTaggedFile[] {
  const softFiltersActive = hasSoftFilters(filters);

  const results: ScoredTaggedFile[] = [];

  for (const file of data.files) {
    if (!passesHardFilters(file, filters)) {
      continue;
    }

    if (softFiltersActive && !passesSoftRelevanceGate(file, filters)) {
      continue;
    }

    const score = computeRelevanceScore(file, filters);

    results.push({ ...file, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

export function searchMedia(filters: SearchFilters): SearchResult {
  const data = loadTagsData();
  const files = filterFiles(data, filters);

  return {
    filters,
    files,
    total: files.length,
  };
}

export function buildClaudeSystemPrompt(): string {
  return `Transformă cererea utilizatorului în limbaj natural într-un set de filtre structurate, folosind DOAR aceste valori permise:

- mood: ${JSON.stringify(ALLOWED_MOODS)}
- dominant_colors: ${JSON.stringify(ALLOWED_COLORS)}
- orientation: ${JSON.stringify(ALLOWED_ORIENTATIONS)}
- channels: ${JSON.stringify(ALLOWED_CHANNELS)}
- has_text: true / false / null (null dacă utilizatorul nu specifică dacă imaginea conține text)
- media_type: "video" / "image" / null
- keywords: cuvinte cheie libere pentru potrivire pe subjects/scene/nume fișier

Reguli generale:
1. Returnează DOAR un obiect JSON valid, fără markdown, fără explicații.
2. Folosește array-uri goale [] pentru categoriile nealese din cerere.
3. Dacă utilizatorul spune "no text" sau similar, setează has_text: false. Dacă cere conținut cu text, setează has_text: true.
4. Mapează sinonimele la valorile permise din listele fixe (ex: "horizontal" → "landscape", "vertical" → "portrait").
5. Nu inventa valori care nu sunt în listele permise.

media_type (regulă universală):
6. Dacă cererea menționează "video", "videos", "clip", "footage", "reel" → media_type = "video".
7. Dacă menționează "photo", "photos", "image", "images", "picture", "still" → media_type = "image".
8. Altfel media_type = null.
9. IMPORTANT: dacă cererea specifică un tip de media, NU pune acel cuvânt (nici sinonimele lui) în keywords. media_type și keywords sunt separate — altfel "video" s-ar potrivi doar pe text, nu pe extensia fișierului.

Extragere conservatoare a keywords (regulă universală, valabilă pentru orice căutare):
10. Extrage termenii SPECIFICI și fideli din cererea utilizatorului, plus sinonime apropiate direct relevante.
11. NU lărgi un termen specific către categoria lui generală. Nu înlocui și nu adăuga cuvinte mai generice decât ce a cerut utilizatorul, dacă acele cuvinte generice ar potrivi conținut nelegat.
   - Principiul (valabil universal, indiferent de subiect): un nume de loc specific NU se extinde la termeni generici ca "city", "urban" sau "place"; un subiect specific NU se extinde la categoria lui largă. Păstrează specificitatea cererii.
12. Preferă puține keywords precise în locul multor keywords generice.
13. Pentru keywords, extrage subiecte, acțiuni, locații, scene concrete sau fragmente de nume de fișier — nu repeta valorile din listele fixe (mood, culori, orientation, channels, media_type).

Formatul JSON exact:
{
  "mood": [],
  "dominant_colors": [],
  "orientation": [],
  "channels": [],
  "has_text": null,
  "media_type": null,
  "keywords": []
}`;
}
