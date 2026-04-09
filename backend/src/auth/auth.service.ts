import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { EntitlementsService } from '../entitlements/entitlements.service';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: any) {
    const user = await this.usersService.findByTenantAndEmail(dto.tenantId, dto.email);
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException();

    return this.issueTokens(user);
  }

  async refresh(dto: any) {
    const tokens = await this.refreshRepo.find({
      where: { revokedAt: IsNull() }
    });

    for (const token of tokens) {
      const match = await bcrypt.compare(dto.refreshToken, token.tokenHash);
      if (match) {
        token.revokedAt = new Date();
        await this.refreshRepo.save(token);
        return this.issueTokens(token.user);
      }
    }

    throw new UnauthorizedException();
  }

  async logout(dto: any) {
    const tokens = await this.refreshRepo.find({
      where: { revokedAt: IsNull() }
    });

    for (const token of tokens) {
      const match = await bcrypt.compare(dto.refreshToken, token.tokenHash);
      if (match) {
        token.revokedAt = new Date();
        await this.refreshRepo.save(token);
      }
    }

    return { success: true };
  }

  async signup(dto: {
    tenantSlug: string;
    tenantName: string;
    email: string;
    password: string;
    fullName: string;
  }) {
    const tenantSlug = dto.tenantSlug.trim().toLowerCase();
    const existingTenant = await this.tenantsService.findBySlug(tenantSlug);
    if (existingTenant) {
      throw new ConflictException('Tenant slug is already in use');
    }

    const tenant = await this.tenantsService.create({
      slug: tenantSlug,
      name: dto.tenantName.trim(),
      status: 'active',
    });

    const existingUser = await this.usersService.findByTenantAndEmail(tenant.id, dto.email);
    if (existingUser) {
      throw new ConflictException('User already exists in tenant');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      tenantId: tenant.id,
      email: dto.email.trim().toLowerCase(),
      fullName: dto.fullName.trim(),
      role: 'admin',
      passwordHash,
      isActive: true,
    });

    await this.entitlementsService.initializeDefaultEntitlements(tenant.id);
    return this.issueTokens(user);
  }

  private async issueTokens(user: any) {
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '15m'
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d'
    });

    const hash = await bcrypt.hash(refreshToken, 10);

    const entity = this.refreshRepo.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 7 * 86400000)
    });

    await this.refreshRepo.save(entity);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        fullName: user.fullName,
      },
    };
  }
}