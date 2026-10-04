import { Body, Controller, ConflictException, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriceService } from '../prices/price.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateStockDto } from './dto/create-stock.dto';

@Controller('stocks')
export class StocksController {
  constructor(
    private prisma: PrismaService,
    private priceService: PriceService,
  ) {}

  @Get()
  findAll() {
    return this.prisma.stock.findMany({ orderBy: { market: 'asc' } });
  }

  // 실시간 시세 조회 (관리자/유저 화면 공용, 인증 불필요 - 종목 정보처럼 공개 데이터로 취급)
  @Get(':id/quote')
  async getQuote(@Param('id') id: string) {
    const stock = await this.prisma.stock.findUnique({ where: { id } });
    if (!stock) return { error: '종목을 찾을 수 없습니다' };
    try {
      const quote = await this.priceService.getQuote({ market: stock.market, code: stock.code });
      return { stockId: stock.id, ...quote };
    } catch (err) {
      return { stockId: stock.id, error: (err as Error).message };
    }
  }
}

// 관리자가 게임 생성 화면에서 목록에 없는 종목을 직접 추가할 수 있도록 하는 API
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/stocks')
export class AdminStocksController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async create(@Body() dto: CreateStockDto) {
    const existing = await this.prisma.stock.findFirst({ where: { code: dto.code } });
    if (existing) throw new ConflictException('이미 등록된 종목코드입니다');
    return this.prisma.stock.create({ data: dto });
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.prisma.stock.delete({ where: { id } });
    return { ok: true };
  }
}
