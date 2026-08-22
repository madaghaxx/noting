/**
 * Lets plain Node import the app's own TypeScript modules, so tests exercise the
 * real store, repository and migrations rather than copies of them.
 *
 * Node 24 strips TypeScript types by itself; what it will not do is resolve the
 * `@/*` alias from tsconfig, guess the extension a TS-style import leaves off,
 * or find a native module like expo-sqlite. This hook covers those three gaps.
 *
 * Must be loaded with `--import`, not a plain import: static imports are all
 * resolved before any module body runs, so a hook registered from inside a test
 * file would arrive too late for that file's own imports.
 */
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolvePath(HERE, "../..");

/**
 * Native modules have no meaning outside a device, so tests get stand-ins. Each
 * one implements only the surface the app calls, against real behaviour where
 * that is possible (SQLite) and an inspectable fake where it is not.
 */
const STANDINS = {
  "expo-sqlite": "expo-sqlite.mjs",
  "expo-local-authentication": "expo-local-authentication.mjs",
  "expo-secure-store": "expo-secure-store.mjs",
};

function probe(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const standin = STANDINS[specifier];

    if (standin) {
      return {
        url: pathToFileURL(resolvePath(HERE, standin)).href,
        shortCircuit: true,
      };
    }

    if (specifier.startsWith("@/")) {
      const url = probe(resolvePath(ROOT, specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }

    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const url = probe(
        resolvePath(dirname(fileURLToPath(context.parentURL)), specifier),
      );
      if (url) return { url, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
