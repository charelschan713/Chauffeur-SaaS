import { IsUUID } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsUUID()
  booking_id!: string;
}
