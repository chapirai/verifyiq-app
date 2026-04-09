import { Injectable } from '@nestjs/common';

@Injectable()
export class ProviderRateLimitService {
  private nextAllowedAt = 0;

  async waitTurn(): Promise<void> {
    const rps = Number(process.env.BV_MAX_RPS ?? 1);
    const minIntervalMs = Math.max(50, Math.floor(1000 / Math.max(1, rps)));
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAllowedAt - now);
    this.nextAllowedAt = Math.max(this.nextAllowedAt, now) + minIntervalMs;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
