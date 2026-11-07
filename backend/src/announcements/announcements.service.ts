import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  findAllForAdmin() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** 사용자 앱 메인화면이 팝업으로 띄울 대상: 활성화 + 노출기간 안에 있는 것들 */
  async findActive() {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateAnnouncementDto, adminId: string) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        active: dto.active ?? true,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        createdBy: adminId,
      },
    });
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('공지사항을 찾을 수 없습니다');

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...dto,
        startAt: dto.startAt !== undefined ? (dto.startAt ? new Date(dto.startAt) : null) : undefined,
        endAt: dto.endAt !== undefined ? (dto.endAt ? new Date(dto.endAt) : null) : undefined,
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('공지사항을 찾을 수 없습니다');
    await this.prisma.announcement.delete({ where: { id } });
    return { ok: true };
  }
}
