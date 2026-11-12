import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PersonalEventPublisher } from './personal-event.publisher.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, PersonalEventPublisher],
  exports: [PersonalEventPublisher],
})
export class RealtimeModule {}
