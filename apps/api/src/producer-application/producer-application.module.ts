import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { User, UserSchema } from '../users/user.schema.js';
import { ProducerApplicationController } from './producer-application.controller.js';
import { ProducerApplicationService } from './producer-application.service.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [ProducerApplicationController],
  providers: [ProducerApplicationService],
  exports: [ProducerApplicationService],
})
export class ProducerApplicationModule {}
