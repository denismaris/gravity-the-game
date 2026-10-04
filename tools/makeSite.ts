/**
 * Writes the public website the stores and AdMob link to - the privacy
 * policy, the terms, how to delete your account, and app-ads.txt - into
 * `site/`, straight from `src/legal/documents.ts`, so the web pages always
 * say exactly what the app says. Re-run after changing the documents:
 *
 *     npx jest --testRegex 'tools/makeSite\.ts$'
 *
 * Then publish `site/` (see site/README.md).
 */
import { LEGAL, LegalDocument, privacyPolicy, termsOfUse } from '../src/legal/documents';

declare const require: (id: string) => { writeFileSync(path: string, data: string): void; mkdirSync(path: string, options: { recursive: boolean }): void };
declare const __dirname: string;

/** The AdMob publisher id - app-ads.txt proves these ads are Tessellatum's. */
const PUBLISHER = 'pub-6910889676255413';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Tessellatum</title>
<style>
  :root { color-scheme: light dark; --ink: #3B1F52; --muted: #6B5A7A; --paper: #F8F2E5; --rule: #E2D6BF; --accent: #B7892F; }
  @media (prefers-color-scheme: dark) { :root { --ink: #F1E6D2; --muted: #C3B4CC; --paper: #15101B; --rule: #2E2536; --accent: #D9AC4E; } }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 17px/1.6 Georgia, 'Times New Roman', serif; }
  main { max-width: 680px; margin: 0 auto; padding: 48px 20px 80px; }
  nav { font: 14px/1.4 -apple-system, system-ui, sans-serif; margin-bottom: 40px; }
  nav a { color: var(--muted); margin-right: 18px; text-decoration: none; }
  nav a:hover { color: var(--accent); }
  .mark { font-weight: bold; letter-spacing: 3px; color: var(--ink); }
  h1 { font-size: 36px; line-height: 1.15; margin: 0 0 12px; }
  h2 { font-size: 22px; margin: 36px 0 6px; padding-top: 18px; border-top: 1px solid var(--rule); }
  .lede { color: var(--muted); font-size: 18px; }
  footer { margin-top: 56px; color: var(--muted); font: 13px/1.5 -apple-system, system-ui, sans-serif; }
</style>
</head>
<body>
<main>
<nav><span class="mark">TESSELLATUM</span> &nbsp; <a href="index.html">Privacy</a><a href="terms.html">Terms</a><a href="delete-account.html">Delete your account</a></nav>
${body}
<footer>© 2026 ${escape(LEGAL.owner || 'Tessellatum')}${LEGAL.email ? ` · <a href="mailto:${escape(LEGAL.email)}">${escape(LEGAL.email)}</a>` : ''}</footer>
</main>
</body>
</html>
`;
}

function documentPage(doc: LegalDocument): string {
  const sections = doc.sections.map(s => `<h2>${escape(s.heading)}</h2>\n${s.paragraphs.map(p => `<p>${escape(p)}</p>`).join('\n')}`).join('\n');
  return page(doc.title, `<h1>${escape(doc.title)}</h1>\n<p class="lede">${escape(doc.lede)}</p>\n${sections}`);
}

const DELETE = page(
  'Delete your account',
  `<h1>Delete your account</h1>
<p class="lede">You can delete your Tessellatum account and everything stored with it at any time.</p>
<h2>In the app (fastest)</h2>
<p>Open Tessellatum, go to Settings, tap your account at the top, then tap <strong>Delete my account and data</strong> and confirm. Your saved progress, your leaderboard name, country, city and results, and any reports you made are permanently removed from our server straight away.</p>
<h2>Without the app</h2>
<p>If you no longer have the app, email ${LEGAL.email ? `<a href="mailto:${escape(LEGAL.email)}">${escape(LEGAL.email)}</a>` : 'us'} from the address of the Google or Apple account you signed in with, with the subject <em>Delete my Tessellatum account</em>. We delete it within 30 days and confirm by email.</p>
<h2>What is kept</h2>
<p>Nothing that identifies you. Progress saved only on your phone is removed when you delete the app.</p>`,
);

test('write the website', () => {
  const fs = require('fs');
  const dir = `${__dirname}/../site`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/index.html`, documentPage(privacyPolicy()));
  fs.writeFileSync(`${dir}/privacy.html`, documentPage(privacyPolicy()));
  fs.writeFileSync(`${dir}/terms.html`, documentPage(termsOfUse()));
  fs.writeFileSync(`${dir}/delete-account.html`, DELETE);
  fs.writeFileSync(`${dir}/app-ads.txt`, `google.com, ${PUBLISHER}, DIRECT, f08c47fec0942fa0\n`);
  fs.writeFileSync(`${dir}/.nojekyll`, '');
});
