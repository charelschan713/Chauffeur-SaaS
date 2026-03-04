import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
