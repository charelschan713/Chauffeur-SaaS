import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformController } from './platform.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PlatformController],
})
export class PlatformModule {}
