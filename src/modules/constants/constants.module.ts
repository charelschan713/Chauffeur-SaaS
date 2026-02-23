import { Module } from '@nestjs/common';
import { ConstantsController } from './constants.controller';
import { ConstantsService } from './constants.service';

@Module({
  controllers: [ConstantsController],
  providers: [ConstantsService],
  exports: [ConstantsService],
})
export class ConstantsModule {}
