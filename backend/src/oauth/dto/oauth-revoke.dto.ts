import { IsString } from 'class-validator';

export class OauthRevokeDto {
  @IsString()
  client_id!: string;

  @IsString()
  client_secret!: string;
}
