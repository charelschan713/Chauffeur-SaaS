import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtGuard],
  exports: [JwtGuard, JwtModule],
})
export class CommonModule {}
