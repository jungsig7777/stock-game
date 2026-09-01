import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Tier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTierConfigDto } from './dto/update-tier-config.dto';

@Injectable()
export class TierConfigService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tierConfig.findMany();
  }

  /**
   * 관리자가 예: 상단계 step 0.2 → 0.1, max 6 → 8 로 "적용"을 누르면
   * 이 한 줄의 업데이트만으로 이후 모든 예측 제출/정산 판정 기준이 즉시 바뀐다.
   * (선택지 목록을 미리 다 만들어서 저장해두는 방식이 아니라, 매 요청마다
   * step/max 를 읽어서 계산하는 구조라 별도 마이그레이션 없이 실시간 반영됨)
   */
  async update(tier: Tier, dto: UpdateTierConfigDto, adminId: string) {
    if (dto.maxPct < dto.stepPct) {
      throw new BadRequestException('최대범위는 단위보다 크거나 같아야 합니다');
    }
    const existing = await this.prisma.tierConfig.findUnique({ where: { tier } });
    if (!existing) throw new NotFoundException('난이도 설정을 찾을 수 없습니다 (seed 먼저 실행하세요)');

    return this.prisma.tierConfig.update({
      where: { tier },
      data: { stepPct: dto.stepPct, maxPct: dto.maxPct, updatedBy: adminId },
    });
  }
}
