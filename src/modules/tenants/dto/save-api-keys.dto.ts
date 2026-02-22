import { IsOptional, IsString } from 'class-validator';

export class SaveApiKeysDto {
  @IsOptional()
  @IsString()
  stripe_secret_key?: string;

  @IsOptional()
  @IsString()
  stripe_webhook_secret?: string;

  @IsOptional()
  @IsString()
  resend_api_key?: string;

  @IsOptional()
  @IsString()
  twilio_account_sid?: string;

  @IsOptional()
  @IsString()
  twilio_auth_token?: string;

  @IsOptional()
  @IsString()
  twilio_from_number?: string;
}
