/**
 * Caption pages: each narration line split into pages of at most two rows,
 * timed from the word stamps. Pages are built against the universal stage's
 * row length, so every platform reads the same words at the same moments;
 * only the position changes per platform.
 */
import { CAPTION, captionCharsPerRow } from "../layout";

export type TimedWord = { text: string; start: number; end: number };

export type CaptionPage = {
  cue: string;
  line: number;
  start: number;
  end: number;
  rows: string[];
  radio: boolean;
};

/** How long a page stays up after its line's last word. */
export const CAPTION_LINGER = 0.25;
/** A page always clears this long before the next line starts. */
const CAPTION_GAP = 0.05;

export const charsPerRow = (universalStageWidth: number): number => captionCharsPerRow(universalStageWidth);

type Draft = { rows: string[]; first: number };

/** A break after punctuation reads better; other breaks cost this many characters. */
const BREAK_PENALTY = 6;
const endsPhrase = (word: string): boolean => /[.,;:!?]["”’)]*$/.test(word);

/** Best split of words into at most `maxRows` rows (1 or 2): shortest longest row, phrase breaks preferred. */
const fitRows = (words: readonly string[], maxChars: number, maxRows: number): { rows: string[]; cost: number } | null => {
  const joined = words.join(" ");
  if (joined.length <= maxChars) return { rows: [joined], cost: joined.length };
  if (maxRows < 2) return null;
  let best: { rows: string[]; cost: number } | null = null;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(" ");
    const b = words.slice(k).join(" ");
    if (a.length > maxChars || b.length > maxChars) continue;
    const cost = Math.max(a.length, b.length) + (endsPhrase(words[k - 1] ?? "") ? 0 : BREAK_PENALTY);
    if (best === null || cost < best.cost) best = { rows: [a, b], cost };
  }
  return best;
};

/**
 * Splits a line's words into caption pages of up to `maxRows` rows of up to
 * `maxChars` characters, using as few pages as possible and, among those,
 * the split whose longest page is shortest, preferring page breaks after
 * punctuation. No orphaned last words.
 */
export const paginate = (words: readonly TimedWord[], maxChars: number, maxRows = CAPTION.maxRows): Draft[] => {
  const texts = words.map((w) => w.text);
  const n = texts.length;
  if (n === 0) return [];
  const page = (i: number, j: number) => fitRows(texts.slice(i, j), maxChars, maxRows);
  // best[i] = cheapest way to page words i..n: [pages, worst page cost, breaks]
  type Plan = { pages: number; worst: number; breaks: number[] };
  const best: (Plan | null)[] = Array.from({ length: n + 1 }, () => null);
  best[n] = { pages: 0, worst: 0, breaks: [] };
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j <= n; j++) {
      const fit = page(i, j);
      const rest = best[j];
      if (fit === null || rest === null || rest === undefined) continue;
      const penalty = j < n && !endsPhrase(texts[j - 1] ?? "") ? BREAK_PENALTY : 0;
      const plan: Plan = { pages: rest.pages + 1, worst: Math.max(rest.worst, fit.cost + penalty), breaks: [j, ...rest.breaks] };
      const cur = best[i];
      if (cur === null || cur === undefined || plan.pages < cur.pages || (plan.pages === cur.pages && plan.worst < cur.worst)) {
        best[i] = plan;
      }
    }
    if (best[i] === null) {
      // A single word longer than a row: give it a page of its own.
      const rest = best[i + 1];
      if (rest !== null && rest !== undefined) best[i] = { pages: rest.pages + 1, worst: rest.worst, breaks: [i + 1, ...rest.breaks] };
    }
  }
  const plan = best[0];
  if (plan === null || plan === undefined) return [{ rows: [texts.join(" ")], first: 0 }];
  const drafts: Draft[] = [];
  let from = 0;
  for (const to of plan.breaks) {
    drafts.push({ rows: page(from, to)?.rows ?? [texts.slice(from, to).join(" ")], first: from });
    from = to;
  }
  return drafts;
};

/** Timed caption pages for one line. */
export const captionLine = (args: {
  cue: string;
  line: number;
  words: readonly TimedWord[];
  lineEnd: number;
  nextLineStart: number | null;
  radio: boolean;
  maxChars: number;
}): CaptionPage[] => {
  const drafts = paginate(args.words, args.maxChars);
  return drafts.map((d, k) => {
    const start = args.words[d.first]?.start ?? args.lineEnd;
    const nextDraft = drafts[k + 1];
    const linger = args.lineEnd + CAPTION_LINGER;
    const cap = args.nextLineStart === null ? linger : Math.min(linger, args.nextLineStart - CAPTION_GAP);
    const end = nextDraft !== undefined ? (args.words[nextDraft.first]?.start ?? cap) : Math.max(args.lineEnd, cap);
    return { cue: args.cue, line: args.line, start, end, rows: d.rows, radio: args.radio };
  });
};
