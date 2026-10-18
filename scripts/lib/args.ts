/** Tiny argv parser: positionals plus --flag, --flag value and --flag=value. */
export type Args = { positional: string[]; flags: Map<string, string | true> };

export const parseArgs = (argv: readonly string[]): Args => {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a.startsWith("--")) {
      const body = a.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags.set(body.slice(0, eq), body.slice(eq + 1));
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--") && !["no-ffmpeg"].includes(body)) {
          flags.set(body, next);
          i++;
        } else {
          flags.set(body, true);
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
};

export const flagString = (args: Args, name: string): string | null => {
  const v = args.flags.get(name);
  return typeof v === "string" ? v : null;
};

export const flagBool = (args: Args, name: string): boolean => args.flags.has(name);

/** Runs a CLI entry point and turns a thrown error into a clean exit code. */
export const main = (run: () => Promise<void> | void): void => {
  Promise.resolve()
    .then(run)
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n✗ ${message}`);
      process.exit(1);
    });
};
