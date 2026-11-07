import { Injectable, Logger } from '@nestjs/common';
import { PriceProvider, StockRef, Quote } from './price.service';
import { kstDateOf } from '../common/date-kst';

const TOKEN_URL = 'https://openapi.tossinvest.com/oauth2/token';
const API_BASE = 'https://openapi.tossinvest.com';

interface TossTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface TossCandle {
  timestamp: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
}

interface TossCandlesResponse {
  result: {
    candles: TossCandle[];
    nextBefore: string | null;
  };
}

/**
 * 토스증권 Open API 연동 provider (2026년 출시, 토스증권 계좌 보유자는 무료로 발급 가능).
 *
 * 발급 방법:
 *  1. 토스증권 PC 웹(WTS)에 로그인 → 설정 > Open API 메뉴에서 client_id / client_secret 발급
 *  2. 같은 화면의 "허용 IP 관리"에 서버의 아웃바운드 IP를 등록해야 함
 *     (등록 안 된 IP에서의 호출은 403으로 차단됨)
 *  3. .env 에 TOSS_CLIENT_ID / TOSS_CLIENT_SECRET 을 채우면
 *     price.module.ts 가 자동으로 이 provider를 사용하도록 이미 연결해뒀음 (별도 코드 수정 불필요)
 *
 * 종가 등락률은 API가 필드로 직접 주지 않아서, 일봉 캔들 2개(당일/전일 종가)를 비교해 계산한다.
 * 참고: https://developers.tossinvest.com
 */
@Injectable()
export class TossPriceProvider implements PriceProvider {
  private readonly logger = new Logger(TossPriceProvider.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }

    const clientId = process.env.TOSS_CLIENT_ID;
    const clientSecret = process.env.TOSS_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('TOSS_CLIENT_ID / TOSS_CLIENT_SECRET 이 .env 에 설정되지 않았습니다');
    }

    // 토스증권 토큰 발급은 client_id/secret 을 본문이 아니라 HTTP Basic 인증 헤더로 보내야 한다
    // (RFC 6749 표준 방식). 본문(client_id/client_secret 파라미터)으로 보내면
    // "Client authentication failed: client_secret" 오류가 난다.
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!res.ok) {
      throw new Error(`토스증권 토큰 발급 실패: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as TossTokenResponse;
    // 만료 60초 전에 미리 갱신해서 경계 시점 요청 실패를 줄인다
    this.cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return data.access_token;
  }

  async getClosingChangePercent(stock: StockRef): Promise<number> {
    const token = await this.getAccessToken();
    const sorted = await this.fetchRecentCandles(token, stock, 2);
    const [today, yesterday] = sorted;

    const pct = ((today.closePrice - yesterday.closePrice) / yesterday.closePrice) * 100;
    const rounded = Math.round(pct * 100) / 100;
    this.logger.log(`${stock.code} 종가 등락률: ${rounded}% (전일 ${yesterday.closePrice} → 당일 ${today.closePrice})`);
    return rounded;
  }

  /**
   * 정산 전용: 지정한 날짜(YYYY-MM-DD, KST)의 일봉 종가를 찾아 직전 거래일 종가와 비교한다.
   * 토스 일봉을 최근 30개 받아 timestamp 를 한국 날짜로 바꿔 날짜가 일치하는 봉을 고른다.
   */
  async getClosingChangePercentOn(stock: StockRef, ymd: string): Promise<number> {
    const token = await this.getAccessToken();
    const candles = await this.fetchCandlesDesc(token, stock, 30);

    const idx = candles.findIndex((c) => kstDateOf(new Date(c.timestamp)) === ymd);
    if (idx === -1) {
      throw new Error(`${ymd} 일봉이 없어요 (휴장일이거나 아직 데이터가 반영되지 않음, symbol=${stock.code})`);
    }
    const target = candles[idx];
    const prev = candles[idx + 1]; // 한 칸 더 과거 = 직전 거래일
    if (!prev) {
      throw new Error(`${ymd} 직전 거래일 봉을 찾지 못했어요 (symbol=${stock.code})`);
    }

    const pct = Math.round(((target.closePrice - prev.closePrice) / prev.closePrice) * 10000) / 100;
    this.logger.log(`${stock.code} ${ymd} 종가 등락률 ${pct}% (직전 거래일 ${prev.closePrice} → ${target.closePrice})`);
    return pct;
  }

  /** 화면에 실시간으로 보여줄 현재가 + 등락률. 현재가는 /prices, 전일종가는 캔들에서 가져와 등락률을 계산한다. */
  async getQuote(stock: StockRef): Promise<Quote> {
    const token = await this.getAccessToken();

    const priceUrl = `${API_BASE}/api/v1/prices?symbols=${encodeURIComponent(stock.code)}`;
    const priceRes = await fetch(priceUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!priceRes.ok) {
      throw new Error(`토스증권 현재가 조회 실패 (symbol=${stock.code}): ${priceRes.status} ${await priceRes.text()}`);
    }
    const priceData = (await priceRes.json()) as {
      result: Array<{ symbol: string; timestamp: string | null; lastPrice: number }>;
    };
    const quote = priceData.result?.find((q) => q.symbol === stock.code) ?? priceData.result?.[0];
    if (!quote) {
      throw new Error(`현재가 데이터가 없습니다 (symbol=${stock.code})`);
    }

    const sorted = await this.fetchRecentCandles(token, stock, 2);
    const prevClose = sorted[1].closePrice;
    const changePercent = Math.round(((quote.lastPrice - prevClose) / prevClose) * 10000) / 100;

    return {
      price: quote.lastPrice,
      changePercent,
      asOf: quote.timestamp ?? new Date().toISOString(),
    };
  }

  /** 최근 일봉을 최신순으로 반환 (개수가 모자라도 있는 만큼만) */
  private async fetchCandlesDesc(token: string, stock: StockRef, count: number): Promise<TossCandle[]> {
    const url =
      `${API_BASE}/api/v1/candles?symbol=${encodeURIComponent(stock.code)}` +
      `&interval=1d&count=${count}&adjusted=false`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new Error(`토스증권 시세 조회 실패 (symbol=${stock.code}): ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as TossCandlesResponse;
    const candles = data.result?.candles ?? [];
    return [...candles].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /** 최근 캔들을 최신순으로 반환하되, 최소 count 개가 없으면 에러 */
  private async fetchRecentCandles(token: string, stock: StockRef, count: number): Promise<TossCandle[]> {
    const sorted = await this.fetchCandlesDesc(token, stock, count);
    if (sorted.length < count) {
      throw new Error(`캔들 데이터가 부족합니다 (symbol=${stock.code}) — 신규상장 종목이거나 휴장일일 수 있음`);
    }
    return sorted;
  }
}
