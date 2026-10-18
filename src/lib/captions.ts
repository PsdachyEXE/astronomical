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

/** Splits words into pages of up to `maxRows` rows of up to `maxChars` characters. */
export const paginate = (words: readonly TimedWord[], maxChars: number, maxRows = CAPTION.maxRows): Draft[] => {
  const pages: Draft[] = [];
  let rows: string[] = [];
  let row = "";
  let first = 0;
  const capacity = maxChars * maxRows;
  const used = () => rows.reduce((n, r) => n + r.length + 1, 0) + row.length;
  const closePage = (nextFirst: number) => {
    if (row !== "") rows.push(row);
    if (rows.length > 0) pages.push({ rows, first });
    rows = [];
    row = "";
    first = nextFirst;
  };
  words.forEach((w, i) => {
    const text = w.text;
    if (row === "") {
      row = text;
    } else if (row.length + 1 + text.length <= maxChars) {
      row = `${row} ${text}`;
    } else if (rows.length + 1 < maxRows) {
      rows.push(row);
      row = text;
    } else {
      closePage(i);
      row = text;
    }
    const endsSentence = /[.!?:]["”’)]*$/.test(text);
    if (endsSentence && i < words.length - 1 && used() >= capacity * 0.5) closePage(i + 1);
  });
  closePage(words.length);
  return pages;
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
