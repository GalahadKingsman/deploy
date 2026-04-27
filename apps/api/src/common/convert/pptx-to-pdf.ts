import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function convertPptxToPdf(params: {
  pptx: Uint8Array;
  timeoutMs?: number;
}): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), 'ep-pptx-'));
  const inPath = join(dir, 'input.pptx');
  const outPath = join(dir, 'input.pdf');
  try {
    await writeFile(inPath, params.pptx);
    await execFileAsync(
      'libreoffice',
      ['--headless', '--nologo', '--nolockcheck', '--nodefault', '--norestore', '--convert-to', 'pdf', '--outdir', dir, inPath],
      { timeout: params.timeoutMs ?? 60_000, maxBuffer: 10 * 1024 * 1024 },
    );
    const pdf = await readFile(outPath);
    return new Uint8Array(pdf);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

