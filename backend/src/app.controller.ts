import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  healthCheck(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'VerifyIQ API',
      timestamp: new Date().toISOString(),
    };
  }
}
