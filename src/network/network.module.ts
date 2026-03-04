import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NetworkController, PlatformNetworkController } from './network.controller';
import { NetworkService } from './network.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [NetworkController, PlatformNetworkController],
  providers: [NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}
