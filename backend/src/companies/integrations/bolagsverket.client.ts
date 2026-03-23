import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class BolagsverketClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get headers() {
    const clientId = this.configService.get<string>('BV_CLIENT_ID');
    const clientSecret = this.configService.get<string>('BV_CLIENT_SECRET');
    return {
      'content-type': 'application/json',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'x-request-id': randomUUID(),
    };
  }

  private mapError(status?: number): never {
    if (status === 400) throw new BadRequestException('Bolagsverket rejected the request');
    if (status === 401) throw new UnauthorizedException('Bolagsverket authentication failed');
    if (status === 403) throw new ForbiddenException('Bolagsverket access forbidden');
    throw new InternalServerErrorException('Bolagsverket request failed');
  }

  async fetchHighValueDataset(identitetsbeteckning: string) {
    const url = 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/organisationer';
    const payload = { identitetsbeteckning };
    try {
      const response = await firstValueFrom(this.httpService.post(url, payload, { headers: this.headers }));
      return { requestPayload: payload, responsePayload: response.data, requestId: this.headers['x-request-id'] };
    } catch (error: any) {
      this.mapError(error?.response?.status);
    }
  }

  async fetchOrganisationInformation(
    identitetsbeteckning: string,
    organisationInformationsmangd: string[] = ['FUNKTIONARER', 'FIRMATECKNING', 'VERKSAMHETSBESKRIVNING'],
  ) {
    const url = 'https://gw.api.bolagsverket.se/foretagsinformation/v4/organisationsinformation';
    const payload = { identitetsbeteckning, organisationInformationsmangd };
    try {
      const response = await firstValueFrom(this.httpService.post(url, payload, { headers: this.headers }));
      return { requestPayload: payload, responsePayload: response.data, requestId: this.headers['x-request-id'] };
    } catch (error: any) {
      this.mapError(error?.response?.status);
    }
  }
}
