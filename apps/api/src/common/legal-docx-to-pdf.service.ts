import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const execFileP = promisify(execFile);

@Injectable()
export class LegalDocxToPdfService {
  private readonly log = new Logger(LegalDocxToPdfService.name);

  /**
   * Converts DOCX bytes to PDF using LibreOffice headless (requires `soffice` on PATH).
   */
  async convert(docxBuffer: Buffer): Promise<Buffer> {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'legal-docx-'));
    const inPath = path.join(tmpRoot, 'document.docx');
    const outPath = path.join(tmpRoot, 'document.pdf');
    try {
      await fs.writeFile(inPath, docxBuffer);
      const env = {
        ...process.env,
        HOME: tmpRoot,
        TMPDIR: tmpRoot,
        SAL_USE_VCLPLUGIN: 'svp',
        LANG: process.env.LANG ?? 'C.UTF-8',
      };
      await execFileP('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', tmpRoot, inPath], {
        timeout: 120_000,
        env,
        maxBuffer: 64 * 1024 * 1024,
      });
      const pdfBuf = await fs.readFile(outPath);
      if (!pdfBuf || pdfBuf.length < 5) {
        throw new Error('LibreOffice did not produce a PDF file');
      }
      if (pdfBuf.slice(0, 5).toString('ascii') !== '%PDF-') {
        throw new Error('LibreOffice output is not a valid PDF');
      }
      return pdfBuf;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`docx to pdf failed: ${msg}`);
      throw e;
    } finally {
      try {
        await fs.rm(tmpRoot, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}
