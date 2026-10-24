import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(frontendDir, 'node_modules', 'vditor', 'dist');
const targetRoot = path.join(frontendDir, 'public', 'vditor');
const target = path.join(targetRoot, 'dist');

await rm(targetRoot, { force: true, recursive: true });
await mkdir(targetRoot, { recursive: true });
await cp(source, target, { recursive: true });
