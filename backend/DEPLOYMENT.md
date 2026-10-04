# 배포 준비 체크리스트

## 지금까지 코드로 이미 반영된 것
- [x] 인증: bcrypt 해시, JWT 액세스/리프레시(회전), 역할 기반 권한(RolesGuard)
- [x] 포인트 정합성: 모든 증감이 `points_ledger` 원장에 기록, 캐시값과 어긋나면 야간 배치가 `FraudAlert` 생성
- [x] 감사로그: `/admin/**` 호출은 자동으로 `AuditLog`에 기록 (누가/언제/무엇을)
- [x] 부정거래 모니터링: 포인트 불일치 · 비정상 적중률 · 추천인 어뷰징 야간 배치(`FraudService`)
- [x] 요청 속도 제한: `@nestjs/throttler` — IP당 분당 120회
- [x] 보안 헤더: `helmet()` 적용
- [x] 트랜잭션 무결성: 예측 제출/정산/쿠폰교환 모두 Prisma `$transaction` 으로 원자적 처리
- [x] Dockerfile / docker-compose (멀티스테이지 빌드, API+DB 한 번에 기동)

## 배포 전 반드시 해야 할 것

### 1. 비밀값 관리
- `.env` 의 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` 를 반드시 무작위 긴 문자열로 교체 (`openssl rand -hex 32` 등)
- seed 로 만든 관리자 계정(`admin@test.com` / `admin1234`) 비밀번호를 즉시 변경하거나 계정을 삭제하고 실제 관리자 계정을 새로 발급
- 운영 환경에서는 `.env` 파일 대신 AWS Secrets Manager / GCP Secret Manager / Vault 같은 비밀관리 서비스 사용 권장

### 2. 네트워크/인프라
- API 서버 앞단에 HTTPS를 종료하는 리버스 프록시(Nginx, Cloudflare, ALB 등) 배치 — 이 프로젝트 자체는 HTTP만 서빙
- PostgreSQL은 퍼블릭 인터넷에 노출하지 말고 API 서버와 같은 VPC/사설망 안에서만 접근 가능하도록 구성
- `docker-compose.yml` 은 로컬/스테이징용입니다. 운영에서는 관리형 DB(RDS 등)를 쓰고 `api` 서비스만 배포하는 걸 권장

### 3. 실시세 연동
- `src/prices/price.service.ts` 의 `MockPriceProvider` 를 실제 증권사/시세 API로 교체 (파일 안에 한국투자증권 예시 주석 있음)
- 시세 API 실패 시 재시도/알림 로직 보강 (현재는 스케줄러가 예외를 삼키고 다음 5분 주기에 재시도만 함)

### 4. 정합성/모니터링 강화
- `FraudAlert` 가 쌓였을 때 관리자에게도 텔레그램으로 알림이 가도록 `NotifyService` 와 연결 (현재는 쿠폰 만료 알림에만 연결되어 있음)
- 로그 수집(예: CloudWatch, Datadog, Sentry)과 알람 연동
- 정기 DB 백업 및 복구 리허설

### 5. 법적/정책 검토 (중요)
- 포인트를 "투자풀 비례 배당" 방식으로 나눠주는 구조는 사행성 게임물로 해석될 소지가 있습니다.
  정식 출시 전 게임산업진흥법·전자금융거래법 관련 **법률 자문을 받는 것을 강력히 권장**합니다.
- 쿠폰(현금성 자산 교환)은 전자상거래법/전자금융거래법 상 선불전자지급수단 규제 대상이 될 수 있어 함께 검토가 필요합니다.

### 6. 부하테스트
- k6, Artillery 등으로 예측 제출 API(`POST /predictions`)와 정산(`settle`) 트랜잭션에 대한 동시성 부하테스트 권장
  (여러 유저가 마감 직전 동시에 예측을 넣는 상황을 재현해서 락/트랜잭션이 버티는지 확인)

## 배포 명령 (docker-compose 기준)

```bash
cp .env.example .env
# .env 값 채운 뒤

docker compose up -d --build
# api 컨테이너가 뜨면서 자동으로 prisma migrate deploy 실행 후 서버 기동
```
