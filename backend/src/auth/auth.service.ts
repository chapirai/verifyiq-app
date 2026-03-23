import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: any) {
    const user = await this.usersService.findByEmail(dto.email);
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

  private async issueTokens(user: any) {
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role
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

    return { accessToken, refreshToken };
  }
}