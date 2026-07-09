#!/usr/bin/env node
/**
 * Bump automatique de version, appele par push.bat avant chaque commit.
 *
 * - Lit la premiere ligne de _commit_msg.txt pour deviner le type de bump
 *   (convention conventional commits, deja utilisee dans ce projet) :
 *     feat:              -> minor
 *     feat!: / BREAKING  -> major
 *     fix/chore/refactor/docs/ci/style/perf/test/wiki -> patch
 * - Bump frontend/package.json + package-lock.json via `npm version`
 * - Synchronise backend/app/main.py (2 occurrences de version="X.Y.Z")
 * - Transforme la section "## [Unreleased]" de CHANGELOG.md en
 *   "## [X.Y.Z] — YYYY-MM-DD" et recree une section Unreleased vide au-dessus
 *
 * Ne fait rien (exit 0, aucun bump) si _commit_msg.txt est absent.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;
const commitMsgPath = path.join(root, '_commit_msg.txt');
const pkgPath = path.join(root, 'frontend', 'package.json');
const mainPyPath = path.join(root, 'backend', 'app', 'main.py');
const changelogPath = path.join(root, 'CHANGELOG.md');

if (!fs.existsSync(commitMsgPath)) {
  console.log('[version-bump] _commit_msg.txt introuvable — bump ignore.');
  process.exit(0);
}

const firstLine = fs.readFileSync(commitMsgPath, 'utf8').split(/\r?\n/)[0].trim();

function detectBumpType(line) {
  const isBreaking = /BREAKING CHANGE/i.test(line) || /^[a-zA-Z]+(\([^)]*\))?!:/.test(line);
  if (isBreaking) return 'major';
  if (/^feat(\([^)]*\))?:/i.test(line)) return 'minor';
  return 'patch'; // fix, chore, refactor, docs, ci, style, perf, test, wiki, ...
}

const bumpType = detectBumpType(firstLine);
console.log(`[version-bump] Message : "${firstLine}"`);
console.log(`[version-bump] Type de bump detecte : ${bumpType}`);

if (!fs.existsSync(pkgPath)) {
  console.error('[version-bump] frontend/package.json introuvable — bump annule.');
  process.exit(1);
}

try {
  execSync(`npm version ${bumpType} --no-git-tag-version --allow-same-version`, {
    cwd: path.join(root, 'frontend'),
    stdio: 'inherit',
  });
} catch (err) {
  console.error('[version-bump] Echec npm version :', err.message);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const newVersion = pkg.version;

// Sync backend/app/main.py (title version + endpoint racine)
if (fs.existsSync(mainPyPath)) {
  let content = fs.readFileSync(mainPyPath, 'utf8');
  content = content.replace(/version="[\d.]+"/, `version="${newVersion}"`);
  content = content.replace(/"version":\s*"[\d.]+"/, `"version": "${newVersion}"`);
  fs.writeFileSync(mainPyPath, content, 'utf8');
} else {
  console.log('[version-bump] backend/app/main.py introuvable — sync ignoree.');
}

// Stamp CHANGELOG.md : Unreleased -> version datee, nouvelle section Unreleased vide
if (fs.existsSync(changelogPath)) {
  let cl = fs.readFileSync(changelogPath, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const marker = '## [Unreleased]';
  if (cl.includes(marker)) {
    cl = cl.replace(
      marker,
      `${marker}\n\n*(prochaines modifications en cours)*\n\n---\n\n## [${newVersion}] — ${today}`
    );
    fs.writeFileSync(changelogPath, cl, 'utf8');
  } else {
    console.log('[version-bump] Section "## [Unreleased]" introuvable dans CHANGELOG.md — non modifie.');
  }
} else {
  console.log('[version-bump] CHANGELOG.md introuvable — non modifie.');
}

console.log(`[version-bump] Nouvelle version : v${newVersion}`);
