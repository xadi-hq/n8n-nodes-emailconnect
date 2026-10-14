#!/usr/bin/env node
// Lints this repo's source with the exact ESLint setup n8n's community-package
// scanner (`npx @n8n/scan-community-package n8n-nodes-emailconnect`) applies to a
// published version, so violations surface before publishing rather than in
// verification review. Run via `npm run lint:n8n`; the pre-push hook runs it.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolDir, '../..');

if (!existsSync(resolve(toolDir, 'node_modules/@n8n/scan-community-package'))) {
	const install = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--silent'], {
		cwd: toolDir,
		stdio: 'inherit',
	});
	if (install.status !== 0) process.exit(install.status ?? 1);
}

// The scanner module creates a temp dir on import; have it removed on exit.
const { default: tmp } = await import('tmp');
tmp.setGracefulCleanup();

const { analyzePackage, SOURCE_FILE_PATTERNS } = await import(
	'@n8n/scan-community-package/scanner/scanner.mjs'
);

const result = await analyzePackage(repoRoot, SOURCE_FILE_PATTERNS);
if (result.passed) {
	console.log('n8n community-package lint passed');
} else {
	console.error(`n8n community-package lint failed: ${result.message}`);
	if (result.details) console.error(result.details);
	process.exit(1);
}
