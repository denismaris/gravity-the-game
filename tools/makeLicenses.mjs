// Writes src/legal/licenses.generated.json: every open-source package the
// app ships (the production dependency tree, plus the native sign-in SDKs
// CocoaPods and Gradle pull in), with its licence text - for the
// Open-source licences screen. Run after adding or updating a dependency:
//
//     node tools/makeLicenses.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seen = new Map();

function resolve(name, from) {
  let dir = from;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function licenceText(dir) {
  const file = readdirSync(dir).find(f => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  return file ? readFileSync(join(dir, file), 'utf8').trim() : null;
}

function walk(name, from) {
  const dir = resolve(name, from);
  if (!dir) return;
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) return;
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? (Array.isArray(pkg.licenses) ? pkg.licenses.map(l => l.type).join(' OR ') : 'See text');
  seen.set(key, { name: pkg.name, version: pkg.version, license, text: licenceText(dir) });
  for (const dep of Object.keys(pkg.dependencies ?? {})) walk(dep, dir);
}

const app = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const dep of Object.keys(app.dependencies)) walk(dep, root);

// Native SDKs that are not npm packages.
const native = [
  { name: 'Google Sign-In for iOS / Android', version: '', license: 'Apache-2.0', text: 'Copyright Google LLC. Licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0' },
  { name: 'AppAuth, GTMAppAuth, GTMSessionFetcher', version: '', license: 'Apache-2.0', text: 'Copyright Google LLC and the OpenID Foundation. Licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0' },
  { name: 'Skia', version: '', license: 'BSD-3-Clause', text: 'Copyright (c) 2011 Google Inc. All rights reserved. Redistribution and use in source and binary forms, with or without modification, are permitted under the BSD 3-Clause License: https://skia.org/license' },
];

// A package that ships no licence file still names its licence: point to
// the standard text.
const withText = p => p.text ? p : { ...p, text: `Licensed under the ${p.license} licence. Full text: https://spdx.org/licenses/${p.license.replace(/[()]/g, '').split(' ')[0]}.html` };
const list = [...seen.values(), ...native].map(withText).sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(root, 'src', 'legal', 'licenses.generated.json'), JSON.stringify(list) + '\n');
console.log(`${list.length} packages; licences: ${[...new Set(list.map(p => p.license))].join(', ')}; missing text: ${list.filter(p => !p.text).map(p => p.name).join(', ') || 'none'}`);
