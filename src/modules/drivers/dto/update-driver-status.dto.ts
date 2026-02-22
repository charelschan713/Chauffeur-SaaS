import { IsIn } from 'class-validator';

export class UpdateDriverStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
