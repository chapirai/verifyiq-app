import { Injectable } from '@nestjs/common';
import * as unzipper from 'unzipper';
import { Readable } from 'stream';

@Injectable()
export class ZipStreamService {
  async openEntryStream(
    zipFilePath: string,
    selector: (entryPath: string) => boolean,
  ): Promise<{ entryPath: string; stream: Readable }> {
    const dir = await unzipper.Open.file(zipFilePath);
    const entry = dir.files.find(f => f.type === 'File' && selector(f.path));
    if (!entry) throw new Error('ZIP did not contain expected target entry');
    return { entryPath: entry.path, stream: entry.stream() as unknown as Readable };
  }
}

