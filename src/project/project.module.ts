import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
