/** Series constants every episode shares. */

export const SERIES = {
  title: "TALLY",
  logline:
    "After the flash, a looped radio message promises rescue to groups of ten. On the Stuart Highway, a road train driver starts counting.",
  fiction:
    "Fiction. The Northern Recovery Authority and its message are invented; this is not a real emergency broadcast.",
} as const;

/** Verbatim, never varied, always through the radio filter. */
export const AUTHORITY_MESSAGE =
  "Northern Recovery Authority. Aircraft will not land for fewer than ten. Gather. Report your number on channel seven at last light. Do not travel after dark.";

/** Number words for the narrator's signature line ("Day one. Tally: one."). */
export const numberWord = (n: number): string => {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (n < 20) return ones[n] ?? String(n);
  if (n < 100) {
    const t = tens[Math.floor(n / 10)] ?? String(n);
    return n % 10 === 0 ? t : `${t}-${ones[n % 10]}`;
  }
  return String(n);
};
