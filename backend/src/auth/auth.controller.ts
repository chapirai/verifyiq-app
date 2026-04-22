import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { SignupDto } from './dto/signup.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Get('tenant/:slug')
  async getTenantBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findBySlug(slug);
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug "${slug}" not found`);
    }
    return { id: tenant.id, name: tenant.name, slug: tenant.slug };
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<any> {
    return this.authService.login(dto);
  }

  @Post('signup')
  async signup(@Body() dto: SignupDto): Promise<any> {
    return this.authService.signup(dto);
  }

  @Post('signup/resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<any> {
    return this.authService.resendVerification(dto);
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string): Promise<any> {
    return this.authService.verifyEmailToken(token);
  }

  @Post('set-password')
  async setPassword(@Body() dto: SetPasswordDto): Promise<any> {
    return this.authService.setPassword(dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<any> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<any> {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<any> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  async logout(@Body() dto: LogoutDto): Promise<{ success: boolean }> {
    return this.authService.logout(dto);
  }
}