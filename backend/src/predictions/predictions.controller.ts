import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { PredictionsService } from './predictions.service';
import { SubmitPredictionDto } from './dto/submit-prediction.dto';

@UseGuards(JwtAuthGuard)
@Controller('predictions')
export class PredictionsController {
  constructor(private predictionsService: PredictionsService) {}

  @Post()
  submit(@Body() dto: SubmitPredictionDto, @CurrentUser() user: JwtPayload) {
    return this.predictionsService.submit(user.sub, dto);
  }

  @Get('me')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.predictionsService.findMine(user.sub);
  }

  // 난이도별 오늘 베팅 가능 횟수/다음 베팅 가능 시각 (예측 화면 안내용)
  @Get('limits')
  getLimits(@CurrentUser() user: JwtPayload) {
    return this.predictionsService.getLimits(user.sub);
  }
}
