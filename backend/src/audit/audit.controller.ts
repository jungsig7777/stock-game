import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.auditService.findAll(limit ? Number(limit) : 100);
  }
}
