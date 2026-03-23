import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateWebhookEndpointDto {
  @IsString()
  name!: string;

  @IsUrl({ require_tld: false })
  targetUrl!: string;

  @IsString()
  @MinLength(12)
  secret!: string;

  @IsArray()
  @IsString({ each: true })
  subscribedEvents!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
