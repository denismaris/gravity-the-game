// Node's own modules, typed only as far as this test uses them - the app
// has no Node type definitions.
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): { isDirectory(): boolean };
};
const { join } = require('path') as { join(...parts: string[]): string };
declare const __dirname: string;

/**
 * Regression test for a hard crash: opening Skyscrapers' "How to play"
 * aborted the app. One `RoundedRect` in its first slide had no `r`. The
 * JavaScript renderer defaults a missing radius to 0, and Jest's Skia mock
 * never draws at all, so nothing here noticed - but since Reanimated came
 * into the app, Skia plays every canvas's recording on the UI thread, and
 * that recorder throws on a RoundedRect without a radius. A throw on the
 * UI runtime is not a red box; it is the app closing.
 *
 * So every `<RoundedRect>` in the app must say its radius (or pass a
 * ready-made `rect`).
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

/** The opening tag starting at `start`, braces respected. */
function openingTag(text: string, start: number): string {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (depth === 0 && c === '>') return text.slice(start, i + 1);
  }
  return text.slice(start);
}

test('every RoundedRect gives its radius', () => {
  const root = join(__dirname, '..', '..');
  const missing: string[] = [];
  for (const file of [...sources(root), join(root, '..', 'App.tsx')]) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/<RoundedRect\b/g)) {
      const tag = openingTag(text, match.index ?? 0);
      if (!/\br=|\brect=|\{\.\.\./.test(tag)) missing.push(`${file.slice(root.length)}:${text.slice(0, match.index).split('\n').length}`);
    }
  }
  expect(missing).toEqual([]);
});
