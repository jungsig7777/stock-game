import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  findAll(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findByAdmin(adminId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
