import { createHash, Hash } from 'crypto';
import { Transform, TransformCallback } from 'stream';

export class StreamChecksumTransform extends Transform {
  private readonly hash: Hash;
  private bytes = 0;

  constructor(algorithm: 'sha256' = 'sha256') {
    super();
    this.hash = createHash(algorithm);
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.bytes += chunk.length;
    this.hash.update(chunk);
    this.push(chunk);
    callback();
  }

  digestHex(): string {
    return this.hash.digest('hex');
  }

  totalBytes(): number {
    return this.bytes;
  }
}

