import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentMethod } from './payment-method.entity';
import {
  AdminPaymentMethodsController,
  ContributorPaymentMethodsController,
} from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentMethod])],
  controllers: [
    AdminPaymentMethodsController,
    ContributorPaymentMethodsController,
  ],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
