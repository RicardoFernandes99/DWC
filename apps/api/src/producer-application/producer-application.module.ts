import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { User, UserSchema } from '../users/user.schema.js';
import { AdminProducerApplicationsController } from './admin-producer-applications.controller.js';
import { ProducerApplicationController } from './producer-application.controller.js';
import { ProducerApplicationService } from './producer-application.service.js';
import { ProducerProfileController } from './producer-profile.controller.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [
    ProducerApplicationController,
    ProducerProfileController,
    AdminProducerApplicationsController,
  ],
  providers: [ProducerApplicationService],
  exports: [ProducerApplicationService],
})
export class ProducerApplicationModule {}
