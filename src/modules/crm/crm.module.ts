import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { ContactsService } from './contacts.service';
import { PassengersService } from './passengers.service';

@Module({
  controllers: [CrmController],
  providers: [ContactsService, PassengersService],
  exports: [ContactsService, PassengersService],
})
export class CrmModule {}
