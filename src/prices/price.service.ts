import { Inject, Injectable, Logger } from '@nestjs/common';

export interface StockRef {
  market: string; // 'KR' | 'US'
  code: string;
}

export interface Quote {
  price: number;
  changePercent: number; // 전일 종가 대비 등락률(%), 예: +2.35, -1.10
  asOf: string; // ISO 문자열
}

/**
 * 시세 provider 인터페이스.
 * 실서비스에서는 이 인터페이스만 구현하는 클래스를 새로 만들어서
 * PRICE_PROVIDER 토큰에 바인딩하면 GamesService/Scheduler 코드는 한 줄도 안 바꿔도 됩니다.
 *
 * 예시:
 *  - 국내: 토스증권 Open API (구현 완료, toss-price.provider.ts), 한국투자증권 OpenAPI
 *  - 해외: Alpha Vantage / Finnhub / Polygon.io
 */
export interface PriceProvider {
  /** 전일 종가 대비 등락률(%)을 반환한다. 예: +2.35, -1.10 — 게임 정산(확정 종가)용 */
  getClosingChangePercent(stock: StockRef): Promise<number>;

  /** 현재가 + 등락률을 함께 반환한다 — 화면에 실시간 시세를 보여주는 용도 */
  getQuote(stock: StockRef): Promise<Quote>;
}

export const PRICE_PROVIDER = 'PRICE_PROVIDER';

/**
 * 실 API 키가 아직 없는 개발 단계용 목(mock) provider.
 * 랜덤한 등락률을 반환해서 정산 로직을 계속 테스트할 수 있게 해준다.
 * .env 에 실제 API 키가 준비되면 KoreaInvestmentPriceProvider / TossPriceProvider 같은
 * 클래스를 새로 만들어 PriceModule 에서 교체하면 된다.
 */
@Injectable()
export class MockPriceProvider implements PriceProvider {
  private readonly logger = new Logger(MockPriceProvider.name);

  async getClosingChangePercent(stock: StockRef): Promise<number> {
    const pct = Math.round((Math.random() * 14 - 7) * 100) / 100; // -7.00 ~ +7.00
    this.logger.warn(
      `[MOCK] ${stock.market} ${stock.code} 종가 등락률 ${pct}% (실 API 미연동 - 개발용 랜덤값)`,
    );
    return pct;
  }

  async getQuote(stock: StockRef): Promise<Quote> {
    const pct = Math.round((Math.random() * 14 - 7) * 100) / 100;
    const basePrice = stock.market === 'KR' ? 50000 : 150;
    const price = Math.round(basePrice * (1 + pct / 100));
    return { price, changePercent: pct, asOf: new Date().toISOString() };
  }
}

/*
 * 실 API 연동 예시 스켈레톤 (한국투자증권 OpenAPI 기준, 실제로는 OAuth 토큰 발급이 선행되어야 함)
 *
 * @Injectable()
 * export class KoreaInvestmentPriceProvider implements PriceProvider {
 *   constructor(private http: HttpService, private config: ConfigService) {}
 *
 *   async getClosingChangePercent(stock: StockRef): Promise<number> {
 *     const token = await this.getAccessToken(); // 사전에 발급받은 OAuth 토큰 캐싱
 *     const res = await this.http.axiosRef.get(
 *       'https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price',
 *       {
 *         headers: { authorization: `Bearer ${token}`, appkey: ..., appsecret: ... },
 *         params: { FID_INPUT_ISCD: stock.code, FID_COND_MRKT_DIV_CODE: 'J' },
 *       },
 *     );
 *     return Number(res.data.output.prdy_ctrt); // 전일대비 등락률(%) 필드
 *   }
 * }
 */

@Injectable()
export class PriceService {
  constructor(@Inject(PRICE_PROVIDER) private provider: PriceProvider) {}

  getClosingChangePercent(stock: StockRef) {
    return this.provider.getClosingChangePercent(stock);
  }

  getQuote(stock: StockRef) {
    return this.provider.getQuote(stock);
  }
}
