import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(p);
    } else if (entry.isFile()) {
      yield p;
    }
  }
}

function gzipSizeBytes(buffer: Buffer): number {
  return zlib.gzipSync(buffer, { level: 9 }).byteLength;
}

function main(): void {
  const repoRoot = path.resolve(__dirname, '..');
  const chunksDir = path.join(repoRoot, '.next', 'static', 'chunks');
  if (!fs.existsSync(chunksDir)) {
    throw new Error(`Missing ${chunksDir}. Run 'pnpm build' first.`);
  }

  const maxTotalGzipKb = Number(process.env.BUNDLE_BUDGET_TOTAL_GZIP_KB ?? '1800');
  const maxSingleGzipKb = Number(process.env.BUNDLE_BUDGET_SINGLE_GZIP_KB ?? '250');

  let totalGzipBytes = 0;
  let maxSingleBytes = 0;
  let maxSingleFile = '';

  for (const filePath of walk(chunksDir)) {
    if (!filePath.endsWith('.js')) continue;
    const content = fs.readFileSync(filePath);
    const gz = gzipSizeBytes(content);
    totalGzipBytes += gz;
    if (gz > maxSingleBytes) {
      maxSingleBytes = gz;
      maxSingleFile = filePath;
    }
  }

  const totalKb = totalGzipBytes / 1024;
  const maxKb = maxSingleBytes / 1024;

  const overTotal = totalKb > maxTotalGzipKb;
  const overSingle = maxKb > maxSingleGzipKb;

  if (!overTotal && !overSingle) {
    console.log(
      `OK: Next.js bundle budget met. total_gzip_kb=${totalKb.toFixed(1)} max_single_gzip_kb=${maxKb.toFixed(
        1,
      )}`,
    );
    return;
  }

  console.error('FAILED: Next.js bundle budget exceeded.');
  console.error(`- total_gzip_kb=${totalKb.toFixed(1)} (budget ${maxTotalGzipKb})`);
  console.error(
    `- max_single_gzip_kb=${maxKb.toFixed(1)} (budget ${maxSingleGzipKb}) file=${maxSingleFile}`,
  );
  process.exitCode = 1;
}

main();
