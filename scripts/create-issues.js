#!/usr/bin/env node
/**
 * create-issues.js
 *
 * Reads YAML issue-definition files from `.github/issues/` and creates the
 * corresponding GitHub issues via the REST API.
 *
 * Usage (local):
 *   GITHUB_TOKEN=<pat> GITHUB_REPOSITORY=owner/repo node scripts/create-issues.js
 *
 * The script is also called automatically by the GitHub Actions workflow
 * `.github/workflows/create-issues.yml`.
 *
 * Issue file format – see `.github/issues/example.yml` for the full schema.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Configuration ────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY; // "owner/repo"
const DRY_RUN = process.env.DRY_RUN === 'true';
const ISSUES_DIR = path.resolve(__dirname, '../.github/issues');

if (!GITHUB_TOKEN) {
  if (DRY_RUN) {
    console.log('DRY RUN mode – GITHUB_TOKEN not required.');
  } else {
    console.error('ERROR: GITHUB_TOKEN environment variable is required.');
    process.exit(1);
  }
}

if (!GITHUB_REPOSITORY) {
  console.error('ERROR: GITHUB_REPOSITORY environment variable is required (format: owner/repo).');
  process.exit(1);
}

const [owner, repo] = GITHUB_REPOSITORY.split('/');

// ─── YAML parser (built-in, no dependencies) ─────────────────────────────────
// We keep it simple: use the built-in `require` for .json files and a minimal
// hand-rolled parser for the subset of YAML we need, so this script has ZERO
// extra npm dependencies.

/**
 * Minimal YAML parser that handles the subset used in issue definition files:
 *   - Top-level key: value pairs
 *   - Lists with `-` items
 *   - Multi-line block scalars (`|`)
 *   - Nested mappings (2-space indent)
 *
 * For production-grade parsing, replace with the `js-yaml` package.
 */
function parseYaml(text) {
  // Try to use js-yaml if it is installed anywhere in the project tree.
  try {
    const jsYamlPaths = [
      path.resolve(__dirname, '../node_modules/js-yaml'),
      path.resolve(__dirname, '../frontend/node_modules/js-yaml'),
      path.resolve(__dirname, '../backend/node_modules/js-yaml'),
    ];
    for (const p of jsYamlPaths) {
      if (fs.existsSync(p)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(p).load(text);
      }
    }
  } catch (_) {
    // fall through to built-in parser
  }

  // ── Minimal built-in parser ──────────────────────────────────────────────
  const lines = text.split('\n');
  const root = {};
  let i = 0;

  function peek() {
    return lines[i] || '';
  }

  function indentOf(line) {
    return line.match(/^(\s*)/)[1].length;
  }

  function stripComment(line) {
    // Remove inline comments, but do not strip `#` inside single- or double-quoted strings.
    // Strategy: walk character-by-character, skip quoted segments, then cut at first bare `#`.
    let inSingle = false;
    let inDouble = false;
    for (let idx = 0; idx < line.length; idx++) {
      const ch = line[idx];
      if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
      if (ch === '#' && !inSingle && !inDouble) {
        return line.slice(0, idx).trimEnd();
      }
    }
    return line;
  }

  function parseValue(raw, baseIndent) {
    const trimmed = raw.trim();

    if (trimmed === '|' || trimmed === '|-' || trimmed === '|+') {
      // Block scalar – collect following lines with greater indent.
      const lines2 = [];
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > baseIndent)) {
        lines2.push(lines[i].slice(baseIndent + 2)); // strip base indent
        i++;
      }
      return lines2.join('\n').trimEnd();
    }

    if (trimmed === '') {
      return null;
    }

    // Quoted string
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Bare number
    if (/^\d+$/.test(trimmed)) return Number(trimmed);

    return trimmed;
  }

  function parseList(baseIndent) {
    const items = [];
    while (i < lines.length) {
      const line = lines[i];
      const lineTrimmed = line.trim();
      if (lineTrimmed === '' || lineTrimmed.startsWith('#')) { i++; continue; }
      if (indentOf(line) < baseIndent) break;
      if (!lineTrimmed.startsWith('-')) break;

      const afterDash = lineTrimmed.slice(1).trim();
      i++;

      if (afterDash === '' || afterDash === '|') {
        // Inline map or block – collect as mapping
        items.push(parseMapping(baseIndent + 2));
      } else if (afterDash.includes(':')) {
        // Inline mapping start: "- key: value"
        const obj = {};
        const colonIdx = afterDash.indexOf(':');
        const key = afterDash.slice(0, colonIdx).trim();
        const val = afterDash.slice(colonIdx + 1).trim();
        obj[key] = parseValue(val, baseIndent + 2);
        // Continue collecting more keys at the same indent level
        Object.assign(obj, parseMapping(baseIndent + 2));
        items.push(obj);
      } else {
        items.push(parseValue(afterDash, baseIndent + 2));
      }
    }
    return items;
  }

  function parseMapping(baseIndent) {
    const obj = {};
    while (i < lines.length) {
      const line = lines[i];
      const lineTrimmed = line.trim();
      if (lineTrimmed === '' || lineTrimmed.startsWith('#')) { i++; continue; }
      if (indentOf(line) < baseIndent) break;

      const trimmed = stripComment(line).trim();
      if (trimmed.startsWith('-')) break; // list item at parent level

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) { i++; continue; }

      const key = trimmed.slice(0, colonIdx).trim();
      const rest = trimmed.slice(colonIdx + 1).trim();
      i++;

      if (rest === '' || rest === '|' || rest === '|-' || rest === '|+') {
        // Look ahead to see if next lines are a list or mapping or block scalar
        while (i < lines.length && lines[i].trim() === '') i++;
        if (i < lines.length) {
          const nextLine = lines[i];
          const nextIndent = indentOf(nextLine);
          if (nextLine.trim().startsWith('-')) {
            obj[key] = parseList(nextIndent);
          } else if (rest === '|' || rest === '|-' || rest === '|+') {
            obj[key] = parseValue(rest, indentOf(line));
          } else {
            obj[key] = parseMapping(nextIndent);
          }
        }
      } else {
        obj[key] = parseValue(rest, indentOf(line));
      }
    }
    return obj;
  }

  const result = parseMapping(0);
  return result;
}

// ─── GitHub API helper ────────────────────────────────────────────────────────

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'User-Agent': 'create-issues-script',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(raw));
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${raw}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Fetch existing issue titles to avoid duplicates ─────────────────────────

async function fetchExistingTitles() {
  const titles = new Set();
  let page = 1;
  while (true) {
    const issues = await githubRequest('GET', `/repos/${owner}/${repo}/issues?state=all&per_page=100&page=${page}`);
    if (!Array.isArray(issues) || issues.length === 0) break;
    issues.forEach((issue) => titles.add(issue.title.trim()));
    if (issues.length < 100) break;
    page++;
  }
  return titles;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(ISSUES_DIR)) {
    console.log(`Issues directory not found: ${ISSUES_DIR}`);
    return;
  }

  const files = fs.readdirSync(ISSUES_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  if (files.length === 0) {
    console.log('No YAML files found in .github/issues/');
    return;
  }

  if (DRY_RUN) {
    console.log('DRY RUN mode – no issues will be created.');
  }

  console.log(`Found ${files.length} issue file(s).${DRY_RUN ? '' : ' Fetching existing issues…'}`);
  const existingTitles = DRY_RUN ? new Set() : await fetchExistingTitles();
  if (!DRY_RUN) console.log(`${existingTitles.size} existing issue(s) found.`);

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(ISSUES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    let parsed;
    try {
      parsed = parseYaml(content);
    } catch (err) {
      console.warn(`  WARN: Could not parse ${file}: ${err.message}`);
      continue;
    }

    // Normalise: support both a single issue and an `issues: [...]` list.
    const issueList = parsed.issues && Array.isArray(parsed.issues)
      ? parsed.issues
      : (parsed.title ? [parsed] : []);

    if (issueList.length === 0) {
      console.log(`  ${file}: no issues defined, skipping.`);
      continue;
    }

    for (const issue of issueList) {
      if (!issue.title) {
        console.warn(`  WARN: Issue in ${file} has no title, skipping.`);
        skipped++;
        continue;
      }

      const title = String(issue.title).trim();

      if (existingTitles.has(title)) {
        console.log(`  SKIP (already exists): "${title}"`);
        skipped++;
        continue;
      }

      const payload = { title };
      if (issue.body) payload.body = String(issue.body);
      if (Array.isArray(issue.labels) && issue.labels.length) payload.labels = issue.labels.map(String);
      if (Array.isArray(issue.assignees) && issue.assignees.length) payload.assignees = issue.assignees.map(String);
      if (issue.milestone) payload.milestone = Number(issue.milestone);

      try {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would create: "${title}"`);
          created++;
        } else {
          const result = await githubRequest('POST', `/repos/${owner}/${repo}/issues`, payload);
          console.log(`  CREATED #${result.number}: "${title}"`);
          existingTitles.add(title); // avoid double-creating within the same run
          created++;
        }
      } catch (err) {
        console.error(`  ERROR creating "${title}": ${err.message}`);
      }
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped (duplicate): ${skipped}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
