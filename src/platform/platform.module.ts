import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformController } from './platform.controller';
import { PlatformSyncService } from './platform-sync.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PlatformController],
  providers: [PlatformSyncService],
})
export class PlatformModule {}
