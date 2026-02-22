import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTokensService } from '../../modules/tenants/api-tokens.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) throw new UnauthorizedException('Missing X-API-Key header');

    const tenant_id = await this.apiTokensService.validateToken(apiKey);
    if (!tenant_id)
      throw new UnauthorizedException('Invalid or revoked API key');

    request.tenant_id = tenant_id;
    return true;
  }
}
