import { IsUUID } from 'class-validator';

export class RefundDto {
  @IsUUID()
  booking_id!: string;
}
