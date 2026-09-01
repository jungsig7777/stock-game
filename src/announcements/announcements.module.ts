import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { AdminAnnouncementsController } from './admin-announcements.controller';

@Module({
  providers: [AnnouncementsService],
  controllers: [AnnouncementsController, AdminAnnouncementsController],
})
export class AnnouncementsModule {}
