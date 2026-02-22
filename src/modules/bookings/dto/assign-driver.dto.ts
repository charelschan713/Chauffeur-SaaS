import { IsString } from 'class-validator';

export class AssignDriverDto {
  @IsString()
  driver_id!: string;
}
