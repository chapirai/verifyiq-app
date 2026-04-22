import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import nodemailer, { Transporter } from 'nodemailer';

import { EntitlementsService } from '../entitlements/entitlements.service';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { OauthService } from '../oauth/oauth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/user.entity';
import { PendingSignupEntity } from './entities/pending-signup.entity';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { PasswordSetupTokenEntity, PasswordSetupTokenType } from './entities/password-setup-token.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly inMemoryRateLimit = new Map<string, number[]>();
  private mailer: Transporter | null = null;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PendingSignupEntity)
    private readonly pendingSignupRepo: Repository<PendingSignupEntity>,
    @InjectRepository(EmailVerificationTokenEntity)
    private readonly verificationTokenRepo: Repository<EmailVerificationTokenEntity>,
    @InjectRepository(PasswordSetupTokenEntity)
    private readonly passwordSetupTokenRepo: Repository<PasswordSetupTokenEntity>,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly apiKeysService: ApiKeysService,
    private readonly oauthService: OauthService,
    private readonly auditService: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private randomToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async consumeRateLimit(key: string, max: number, windowMs: number): Promise<void> {
    const now = Date.now();
    const bucket = this.inMemoryRateLimit.get(key) ?? [];
    const pruned = bucket.filter(ts => now - ts <= windowMs);
    if (pruned.length >= max) {
      throw new HttpException('Please wait before trying again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    pruned.push(now);
    this.inMemoryRateLimit.set(key, pruned);
  }

  private passwordPolicyOrThrow(password: string): void {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (password.length < 10 || !hasUpper || !hasLower || !hasDigit) {
      throw new BadRequestException(
        'Password must be at least 10 characters and include uppercase, lowercase, and number.',
      );
    }
  }

  private deriveTenantFromSignup(email: string, companyName?: string | null): { slug: string; name: string } {
    const raw = companyName?.trim() || email.split('@')[1]?.split('.')[0] || 'workspace';
    const base = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'workspace';
    return {
      slug: `${base}-${randomBytes(3).toString('hex')}`,
      name: companyName?.trim() || `${raw.charAt(0).toUpperCase()}${raw.slice(1)} Workspace`,
    };
  }

  private async sendAuthLinkEmail(
    kind: 'verify' | 'set_password' | 'reset_password',
    to: string,
    link: string,
  ): Promise<void> {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');
    const smtpPort = this.config.get<number>('SMTP_PORT', 587);
    const mailFrom = this.config.get<string>('MAIL_FROM', 'noreply@verifyiq.local');
    if (smtpHost && smtpUser && smtpPass) {
      if (!this.mailer) {
        this.mailer = nodemailer.createTransport({
          host: smtpHost,
          port: Number(smtpPort),
          secure: Number(smtpPort) === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });
      }
      const subject =
        kind === 'verify'
          ? 'Verify your VerifyIQ email'
          : kind === 'reset_password'
            ? 'Reset your VerifyIQ password'
            : 'Set your VerifyIQ password';
      await this.mailer.sendMail({
        from: mailFrom,
        to,
        subject,
        text: `Open this secure link: ${link}`,
      });
      return;
    }
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      // In non-production we expose links via logs for local/test environments.
      // eslint-disable-next-line no-console
      console.log(`[auth-email:${kind}] ${to} -> ${link}`);
    }
  }

  private appBaseUrl(): string {
    return this.config.get<string>('APP_BASE_URL', 'http://localhost:3000');
  }

  private async createVerificationToken(pending: PendingSignupEntity): Promise<string> {
    const token = this.randomToken();
    await this.verificationTokenRepo.save(
      this.verificationTokenRepo.create({
        pendingSignupId: pending.id,
        email: pending.email,
        tokenHash: this.sha256(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        consumedAt: null,
      }),
    );
    return token;
  }

  private async createPasswordToken(userId: string, tokenType: PasswordSetupTokenType): Promise<string> {
    const token = this.randomToken();
    await this.passwordSetupTokenRepo.save(
      this.passwordSetupTokenRepo.create({
        userId,
        tokenType,
        tokenHash: this.sha256(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2),
        consumedAt: null,
      }),
    );
    return token;
  }

  async login(dto: { email: string; password: string }) {
    const email = this.normalizeEmail(dto.email);
    await this.consumeRateLimit(`auth:login:${email}`, 10, 60_000);
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException();
    if (!user.isActive || user.status !== 'active') {
      throw new UnauthorizedException('Account is not active.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException();
    if (user.mustChangePassword) {
      throw new UnauthorizedException('Password reset required.');
    }
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);
    await this.auditService.log({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'auth.login.success',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { email },
    });

    return this.issueTokens(user);
  }

  async refresh(dto: any) {
    const tokens = await this.refreshRepo.find({
      where: { revokedAt: IsNull() },
      relations: { user: true },
    });

    for (const token of tokens) {
      const match = await bcrypt.compare(dto.refreshToken, token.tokenHash);
      if (match) {
        if (token.expiresAt.getTime() <= Date.now()) break;
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
    fullName: string;
    email: string;
    companyName?: string;
    termsAccepted: boolean;
  }) {
    if (!dto.termsAccepted) {
      throw new BadRequestException('Terms must be accepted.');
    }
    const email = this.normalizeEmail(dto.email);
    await this.consumeRateLimit(`auth:signup:${email}`, 5, 60_000);
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.status === 'active') {
        throw new ConflictException('An account already exists. Please log in.');
      }
    }
    let pending = await this.pendingSignupRepo.findOne({ where: { email } });
    if (!pending) {
      pending = await this.pendingSignupRepo.save(
        this.pendingSignupRepo.create({
          email,
          fullName: dto.fullName.trim(),
          companyName: dto.companyName?.trim() || null,
          status: 'pending_verification',
          emailVerifiedAt: null,
          tenantId: null,
          userId: null,
        }),
      );
    }
    const token = await this.createVerificationToken(pending);
    const verificationLink = `${this.appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    await this.sendAuthLinkEmail('verify', email, verificationLink);
    return { status: 'verification_sent', email };
  }

  async resendVerification(dto: { email: string }) {
    const email = this.normalizeEmail(dto.email);
    await this.consumeRateLimit(`auth:resend:${email}`, 5, 60_000);
    const pending = await this.pendingSignupRepo.findOne({ where: { email } });
    if (!pending || pending.status === 'completed') {
      return { status: 'ok' };
    }
    const token = await this.createVerificationToken(pending);
    const verificationLink = `${this.appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    await this.sendAuthLinkEmail('verify', email, verificationLink);
    return { status: 'verification_sent' };
  }

  async verifyEmailToken(token: string) {
    const tokenHash = this.sha256(token);
    const row = await this.verificationTokenRepo.findOne({
      where: { tokenHash, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!row) throw new BadRequestException('Invalid verification token.');
    if (row.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Verification token expired.');
    row.consumedAt = new Date();
    await this.verificationTokenRepo.save(row);
    const pending = await this.pendingSignupRepo.findOneByOrFail({ id: row.pendingSignupId });
    pending.emailVerifiedAt = new Date();
    pending.status = 'verified_pending_password';

    if (!pending.tenantId || !pending.userId) {
      const derived = this.deriveTenantFromSignup(pending.email, pending.companyName);
      const tenant = await this.tenantsService.create({
        slug: derived.slug,
        name: derived.name,
        status: 'active',
      });
      const user = await this.usersService.create({
        tenantId: tenant.id,
        email: pending.email,
        fullName: pending.fullName,
        role: 'admin',
        passwordHash: await bcrypt.hash(randomBytes(16).toString('hex'), 10),
        isActive: false,
        status: 'verified_pending_password',
        emailVerifiedAt: pending.emailVerifiedAt,
        mustChangePassword: true,
      });
      pending.tenantId = tenant.id;
      pending.userId = user.id;
      await this.entitlementsService.initializeDefaultEntitlements(tenant.id);
      await this.apiKeysService.ensureSandboxKey(tenant.id);
      await this.oauthService.ensureSandboxClient(tenant.id);
      await this.auditService.log({
        tenantId: tenant.id,
        actorId: user.id,
        action: 'auth.signup.verified',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { email: user.email },
      });
    }

    await this.pendingSignupRepo.save(pending);
    const setupToken = await this.createPasswordToken(pending.userId!, 'setup');
    return {
      status: 'verified',
      passwordSetupToken: setupToken,
      redirectUrl: `${this.appBaseUrl()}/set-password?token=${encodeURIComponent(setupToken)}`,
    };
  }

  async setPassword(dto: { token: string; password: string }) {
    this.passwordPolicyOrThrow(dto.password);
    const tokenHash = this.sha256(dto.token);
    const row = await this.passwordSetupTokenRepo.findOne({
      where: { tokenHash, tokenType: 'setup', consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!row) throw new BadRequestException('Invalid setup token.');
    if (row.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Setup token expired.');
    const user = await this.userRepo.findOneByOrFail({ id: row.userId });
    user.passwordHash = await bcrypt.hash(dto.password, 10);
    user.status = 'active';
    user.isActive = true;
    user.mustChangePassword = false;
    user.emailVerifiedAt = user.emailVerifiedAt ?? new Date();
    await this.userRepo.save(user);
    await this.auditService.log({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'auth.password.setup',
      resourceType: 'user',
      resourceId: user.id,
    });
    row.consumedAt = new Date();
    await this.passwordSetupTokenRepo.save(row);
    await this.pendingSignupRepo.update({ userId: user.id }, { status: 'completed' });
    return this.issueTokens(user);
  }

  async forgotPassword(dto: { email: string }) {
    const email = this.normalizeEmail(dto.email);
    await this.consumeRateLimit(`auth:forgot:${email}`, 5, 60_000);
    const user = await this.userRepo.findOne({ where: { email, status: 'active', isActive: true } });
    if (!user) return { status: 'ok' };
    const resetToken = await this.createPasswordToken(user.id, 'reset');
    const resetLink = `${this.appBaseUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
    await this.sendAuthLinkEmail('reset_password', email, resetLink);
    return { status: 'ok' };
  }

  async resetPassword(dto: { token: string; password: string }) {
    this.passwordPolicyOrThrow(dto.password);
    const tokenHash = this.sha256(dto.token);
    const row = await this.passwordSetupTokenRepo.findOne({
      where: { tokenHash, tokenType: 'reset', consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!row) throw new BadRequestException('Invalid reset token.');
    if (row.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Reset token expired.');
    const user = await this.userRepo.findOneByOrFail({ id: row.userId });
    user.passwordHash = await bcrypt.hash(dto.password, 10);
    user.mustChangePassword = false;
    user.status = 'active';
    user.isActive = true;
    await this.userRepo.save(user);
    row.consumedAt = new Date();
    await this.passwordSetupTokenRepo.save(row);
    await this.refreshRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId: user.id })
      .andWhere('revoked_at IS NULL')
      .execute();
    await this.auditService.log({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'auth.password.reset',
      resourceType: 'user',
      resourceId: user.id,
    });
    return { status: 'password_reset' };
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