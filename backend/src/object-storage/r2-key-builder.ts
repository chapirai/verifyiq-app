export class R2KeyBuilder {
  private isoParts(d: Date): { yyyy: string; mm: string; dd: string } {
    const yyyy = String(d.getUTCFullYear());
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return { yyyy, mm, dd };
  }

  bolagsverketBulkZip(date: Date, fileName = 'file.zip'): string {
    const { yyyy, mm, dd } = this.isoParts(date);
    return `raw/bolagsverket/bulk/${yyyy}/${mm}/${dd}/${fileName}`;
  }

  bolagsverketBulkTxt(date: Date, fileName = 'bulk.txt'): string {
    const { yyyy, mm, dd } = this.isoParts(date);
    return `raw/bolagsverket/bulk/${yyyy}/${mm}/${dd}/${fileName}`;
  }

  bolagsverketAnnualReports(date: Date, orgnr: string, fileName = 'file.zip'): string {
    const { yyyy, mm, dd } = this.isoParts(date);
    return `raw/bolagsverket/annual-reports/${yyyy}/${mm}/${dd}/${orgnr}/${fileName}`;
  }

  ingestionLog(date: Date, ingestionRunId: string): string {
    const { yyyy, mm, dd } = this.isoParts(date);
    return `logs/ingestion/${yyyy}/${mm}/${dd}/${ingestionRunId}.json`;
  }
}

