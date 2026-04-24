import { Injectable } from '@nestjs/common';
import * as unzipper from 'unzipper';
import { PassThrough, Readable } from 'stream';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

@Injectable()
export class ZipStreamService {
  async openEntryStream(
    zipFilePath: string,
    selector: (entryPath: string) => boolean,
  ): Promise<{ entryPath: string; stream: Readable }> {
    const source = createReadStream(zipFilePath);
    const parse = unzipper.Parse({ forceStream: true });
    const out = new PassThrough();

    const entryPath = await new Promise<string>((resolve, reject) => {
      let matched = false;
      source.on('error', reject);
      parse.on('error', reject);
      parse.on('entry', (entry: unzipper.Entry) => {
        const isFile = entry.type === 'File';
        const match = isFile && selector(entry.path);
        if (!matched && match) {
          matched = true;
          resolve(entry.path);
          void pipeline(entry, out).catch((e) => out.destroy(e as Error));
        } else {
          entry.autodrain();
        }
      });
      parse.on('close', () => {
        if (!matched) reject(new Error('ZIP did not contain expected target entry'));
      });
      source.pipe(parse);
    });

    return { entryPath, stream: out };
  }
}

