import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { todayKST, getWeekDatesKST, getWeekKey, getMonthKey, daysInMonth } from '../common/date-kst';

const DAILY_POINT = Number(process.env.ATTEND_DAILY_POINT ?? 10);
const WEEKLY_BONUS = Number(process.env.ATTEND_WEEKLY_BONUS ?? 50);
const MONTHLY_BONUS = Number(process.env.ATTEND_MONTHLY_BONUS ?? 300);

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * 출석체크. userId+date 유니크 제약 덕분에 하루 두 번 체크해도 DB가 막아준다
   * (동시에 두 요청이 와도 트랜잭션 안에서 유니크 제약 위반으로 안전하게 실패한다).
   */
  async checkIn(userId: string) {
    const today = todayKST();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.attendanceLog.findUnique({
        where: { userId_date: { userId, date: today } },
      });
      if (existing) throw new BadRequestException('오늘은 이미 출석했어요');

      await tx.attendanceLog.create({ data: { userId, date: today } });
      await tx.user.update({ where: { id: userId }, data: { points: { increment: DAILY_POINT } } });
      await tx.pointsLedger.create({
        data: { userId, delta: DAILY_POINT, reason: 'daily_attend', refType: 'date', refId: today },
      });

      const bonuses: Array<{ label: string; amount: number }> = [];

      // 이번 주(월~일) 개근 체크
      const weekDates = getWeekDatesKST(today);
      const weekKey = getWeekKey(today);
      const weekCount = await tx.attendanceLog.count({ where: { userId, date: { in: weekDates } } });
      if (weekCount === 7) {
        const already = await tx.pointsLedger.findFirst({
          where: { userId, reason: 'weekly_full_attend', refId: weekKey },
        });
        if (!already) {
          await tx.user.update({ where: { id: userId }, data: { points: { increment: WEEKLY_BONUS } } });
          await tx.pointsLedger.create({
            data: { userId, delta: WEEKLY_BONUS, reason: 'weekly_full_attend', refType: 'week', refId: weekKey },
          });
          bonuses.push({ label: '이번주 개근', amount: WEEKLY_BONUS });
        }
      }

      // 이번 달 개근 체크
      const monthKey = getMonthKey(today);
      const target = daysInMonth(monthKey);
      const monthCount = await tx.attendanceLog.count({
        where: { userId, date: { startsWith: monthKey + '-' } },
      });
      if (monthCount === target) {
        const already = await tx.pointsLedger.findFirst({
          where: { userId, reason: 'monthly_full_attend', refId: monthKey },
        });
        if (!already) {
          await tx.user.update({ where: { id: userId }, data: { points: { increment: MONTHLY_BONUS } } });
          await tx.pointsLedger.create({
            data: { userId, delta: MONTHLY_BONUS, reason: 'monthly_full_attend', refType: 'month', refId: monthKey },
          });
          bonuses.push({ label: '이번달 개근', amount: MONTHLY_BONUS });
        }
      }

      return { dailyPoint: DAILY_POINT, bonuses };
    });
  }

  async getStatus(userId: string) {
    const today = todayKST();
    const todayLog = await this.prisma.attendanceLog.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const weekDates = getWeekDatesKST(today);
    const weekLogs = await this.prisma.attendanceLog.findMany({
      where: { userId, date: { in: weekDates } },
    });
    const weekAttendance = weekDates.map((d) => weekLogs.some((l: { date: string }) => l.date === d));

    const monthKey = getMonthKey(today);
    const monthCount = await this.prisma.attendanceLog.count({
      where: { userId, date: { startsWith: monthKey + '-' } },
    });

    return {
      todayChecked: !!todayLog,
      weekAttendance, // [월,화,수,목,금,토,일]
      monthCount,
      monthTarget: daysInMonth(monthKey),
    };
  }
}
