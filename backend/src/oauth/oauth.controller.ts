import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateOauthClientDto } from './dto/create-oauth-client.dto';
import { OauthRevokeDto } from './dto/oauth-revoke.dto';
import { OauthTokenDto } from './dto/oauth-token.dto';
import { OauthService } from './oauth.service';

@Controller()
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @Post('oauth/token')
  async token(@Body() dto: OauthTokenDto) {
    if (dto.grant_type !== 'client_credentials') {
      return { error: 'unsupported_grant_type' };
    }
    return this.oauthService.issueClientCredentialsToken({
      clientId: dto.client_id,
      clientSecret: dto.client_secret,
      requestedScope: dto.scope,
    });
  }

  @Post('oauth/revoke')
  async revoke(@Body() dto: OauthRevokeDto) {
    return this.oauthService.revokeByClientCredentials(dto.client_id, dto.client_secret);
  }

  @Get('me/oauth-clients')
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() currentUser: JwtUser) {
    const clients = await this.oauthService.listByTenant(currentUser.tenantId);
    return { data: clients };
  }

  @Post('me/oauth-clients')
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateOauthClientDto) {
    const result = await this.oauthService.createClient({
      tenantId: currentUser.tenantId,
      name: dto.name,
      scopes: dto.scopes,
      environment: dto.environment ?? 'live',
    });
    return { data: { ...result.client, clientSecret: result.clientSecret } };
  }

  @Delete('me/oauth-clients/:id')
  @UseGuards(JwtAuthGuard)
  async delete(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return this.oauthService.revokeClient(currentUser.tenantId, id);
  }
}
