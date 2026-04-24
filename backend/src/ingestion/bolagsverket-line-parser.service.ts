import { Injectable } from '@nestjs/common';
import { BolagsverketBulkParser, ParsedBulkLine } from '../bolagsverket-bulk/bolagsverket-bulk.parser';
import { rawRecordHash } from './raw-record-hash.util';

@Injectable()
export class BolagsverketLineParserService {
  constructor(private readonly parser: BolagsverketBulkParser) {}

  parseLine(line: string, _rowNumber: number, parserProfile: string): ParsedBulkLine {
    const parsed = this.parser.parseLineToStaging(line, parserProfile);
    if (!parsed.contentHash) parsed.contentHash = rawRecordHash(line);
    return parsed;
  }
}

