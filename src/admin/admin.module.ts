import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([])],
  controllers: [AdminUsersController],
})
export class AdminModule {}
