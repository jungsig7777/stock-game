import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @Get()
  findAll() {
    return this.announcementsService.findAllForAdmin();
  }

  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: JwtPayload) {
    return this.announcementsService.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.announcementsService.delete(id);
  }
}
