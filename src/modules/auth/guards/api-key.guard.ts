import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-platform-api-key'];

    if (!apiKey || apiKey !== process.env.PLATFORM_API_KEY) {
      throw new UnauthorizedException('Invalid platform API key');
    }

    return true;
  }
}
