# 종가예측게임 백엔드 — 1단계: 인증 + 유저/포인트 원장

프론트엔드 프로토타입의 회원가입 300P, 추천인(신규 +200P / 추천인 +300P) 로직을 실제 DB 트랜잭션으로 구현했습니다.

## 포함된 기능
- `POST /auth/signup` — 회원가입 (+ 추천인 코드 입력 시 자동 보너스 지급)
- `POST /auth/login` — 로그인 (JWT 액세스/리프레시 토큰 발급)
- `POST /auth/refresh` — 액세스 토큰 재발급 (리프레시 토큰 회전)
- `POST /auth/logout` — 로그아웃 (리프레시 토큰 무효화)
- `GET /users/me` — 내 프로필/포인트 조회 (인증 필요)
- `GET /users/me/points-ledger` — 내 포인트 적립/차감 내역 조회
- `GET /users/me/points-integrity` — 포인트 캐시값과 원장 합계가 일치하는지 검증

## 실행 방법 (로컬)

1. PostgreSQL 준비 (로컬 설치 또는 `docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16`)
2. `.env.example` 을 `.env` 로 복사하고 `DATABASE_URL`, JWT 시크릿 값 채우기
3. 의존성 설치
   ```
   npm install
   ```
4. Prisma 클라이언트 생성 + 마이그레이션 (여기 샌드박스 환경은 외부 바이너리 다운로드가 막혀있어 실행하지 못했습니다. 실제 개발 환경에서는 정상 동작합니다)
   ```
   npx prisma generate
   npx prisma migrate dev --name init
   ```
5. 서버 실행
   ```
   npm run start:dev
   ```

## 빠른 테스트 (curl)

```bash
# 1) 회원가입
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"password123","name":"김민준"}'

# 2) 추천인 코드로 가입한 사람의 referralCode 를 응답에서 확인한 뒤, 그 코드로 두 번째 유저 가입
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"b@test.com","password":"password123","name":"이서연","referralCode":"복사한코드"}'

# 3) 로그인
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"password123"}'

# 4) 내 정보 조회 (accessToken은 로그인 응답에서 복사)
curl http://localhost:4000/users/me \
  -H "Authorization: Bearer <accessToken>"
```

## 참고: `npx tsc --noEmit` 검증 결과

이 샌드박스에서 `npm install` 은 정상적으로 끝났지만, `npx prisma generate` 는 Prisma 엔진 바이너리를
받아오는 `binaries.prisma.sh` 도메인이 네트워크 정책상 막혀 있어 실행할 수 없었습니다.
그 결과 `@prisma/client` 가 `Role` enum 등 실제 모델 타입을 아직 갖고 있지 않아 타입체크에서
`Role` 관련 에러 2건이 나오는데, 이는 코드 문제가 아니라 **로컬 환경에서 `npx prisma generate` 를
한 번 실행하면 자동으로 해결되는** 부분입니다. 그 외 로직/문법 오류는 없었습니다.

---

# 2단계: 게임 / 난이도별 투자풀 / 예측 / 정산

## 추가된 기능
- `GET /games` — 진행 중(OPEN)인 게임 목록 (종목 + 난이도별 풀 포함)
- `GET /games/:id` — 게임 상세
- `GET /games/carryover` — 난이도별 이월 대기 포인트 조회 (프론트 홈 화면의 "이월 배너"에 대응)
- `POST /admin/games` — 게임 생성 (종목, 활성 난이도, 초기 시드 포인트, 마감시각) — **생성 시 해당 난이도의 이월 포인트를 자동으로 흡수**
- `POST /admin/games/:id/bonus` — 특정 게임의 특정 난이도에 이벤트 보너스 포인트 지급
- `POST /admin/games/:id/settle` — 정산 실행 (실제 등락률을 입력하면, 난이도별로 적중자에게 스테이크 비율대로 정확히 배당하거나 적중자가 없으면 이월)
- `POST /predictions` — 예측 제출 (스테이크 차감 + 해당 난이도 풀에 실시간 반영)
- `GET /predictions/me` — 내 예측 내역
- `GET /tier-config` — 현재 난이도별 단위(%)/최대범위(%) 조회
- `PUT /admin/tier-config/:tier` — 난이도 단위/범위 일괄 수정 (예: 상단계를 0.2%→0.1%, ±6%→±8%로 변경하면 이후 모든 예측 제출/정산 판정에 즉시 반영)

## 프로토타입과 달라진 점 (개선 사항)
프론트 프로토타입은 실제 다른 참여자가 없어서 "적중자가 있을 확률"을 임의로 흉내 냈지만,
실서비스에서는 모든 참여자가 실제 `predictions` 테이블에 기록되므로 **그 확률 시뮬레이션이 필요 없습니다.**
정산 시 해당 난이도의 pending 예측을 전부 조회해서, 실제로 적중한 사람이 있으면 그 사람들끼리
스테이크 비율대로 정확히 나누고, 아무도 없으면 전액 이월합니다.

## 실행 방법 (1단계에 이어서)

```bash
npm install
npx prisma generate
npx prisma migrate dev --name add_games_predictions
npx ts-node prisma/seed.ts   # 종목/난이도기준/이월풀/관리자 계정(admin@test.com / admin1234) 생성
npm run start:dev
```

## 빠른 테스트 흐름 (curl)

```bash
# 0) 관리자 로그인 (seed 로 만들어진 계정)
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin1234"}'
# 응답의 accessToken을 이후 요청에 사용 (아래 <ADMIN_TOKEN> 자리에 대입)

# 1) 종목 id 확인용으로 아무 유저 토큰이든 games 목록을 먼저 조회해도 되지만,
#    지금은 아직 게임이 없으니 종목 id는 DB(pgAdmin)에서 Stock 테이블을 열어 확인하세요.

# 2) 게임 생성 (관리자)
curl -X POST http://localhost:4000/admin/games \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"stockId":"<STOCK_ID>","tiers":["LOW","MID","HIGH"],"seedPoints":1000,"deadlineAt":"2026-12-31T06:30:00.000Z"}'

# 3) 일반 유저로 회원가입 후 로그인해서 <USER_TOKEN> 획득 (1단계 참고)

# 4) 예측 제출 (일반 유저)
curl -X POST http://localhost:4000/predictions \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"gameId":"<GAME_ID>","tier":"LOW","predictedPct":2,"stakePoints":100}'

# 5) 정산 (관리자) - 실제 등락률을 2%로 가정
curl -X POST http://localhost:4000/admin/games/<GAME_ID>/settle \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"actualPct":2}'

# 6) 내 포인트가 늘었는지 확인
curl http://localhost:4000/users/me -H "Authorization: Bearer <USER_TOKEN>"
```

## 다음 단계 (3단계 예고)
- 실시간 시세 API 연동 (`actualPct` 를 관리자가 수동 입력하는 대신 공식 종가로 자동 계산)
- 마감시각 도달 시 게임을 자동으로 `LOCKED` 처리하고, 정산을 예약 실행하는 배치/큐
- 쿠폰(코드/유효기간/재고) 테이블 + 교환 API, 만료 임박 알림(텔레그램/카카오) 배치

---

# 3단계: 실시간 시세 연동(자리) / 자동 정산 배치 / 쿠폰 / 만료 알림

## 추가된 기능

**쿠폰**
- `GET /coupons` — 쿠폰 목록 (사용자용, 인증 불필요)
- `POST /coupons/:id/redeem` — 포인트로 쿠폰 교환 → **응답에 코드+유효기간이 바로 담겨서** 화면에서 즉시 보여줄 수 있음
- `GET /coupons/me/redemptions` — 내가 교환한 쿠폰 목록 (코드/유효기간 스냅샷 포함)
- `POST /admin/coupons` — 쿠폰 등록 (이름/가격/재고/**쿠폰번호**/**유효기간**)
- `GET /admin/coupons/expiring?days=30` — 만료 임박 쿠폰 조회
- `DELETE /admin/coupons/:id` — 쿠폰 삭제

**만료 알림 (텔레그램 / 카카오)**
- `GET /admin/notify/settings`, `PUT /admin/notify/settings` — 텔레그램 봇 토큰/채팅ID, 채널 on/off 저장
- `POST /admin/notify/send-expiry-alert` — 지금 바로 만료임박 쿠폰 알림 발송 (프로토타입의 "지금 알림 보내기" 버튼과 동일)
- `GET /admin/notify/logs` — 발송 이력
- 텔레그램은 **실제로 동작하는 코드**입니다 (Bot API에 진짜 HTTP 요청을 보냄). 카카오 비즈메시지는 발송대행사 계약이 필요해 자리표시자(로그만 남김)로 남겨뒀어요.

**시세 연동 (교체 가능한 구조)**
- `src/prices/price.service.ts` 에 `PriceProvider` 인터페이스를 정의하고, 지금은 `MockPriceProvider`(랜덤값)를 기본으로 꽂아뒀습니다.
- 실제 증권사/시세 API 키가 준비되면 `KoreaInvestmentPriceProvider` 같은 새 클래스 하나만 만들어서 `price.module.ts`의 한 줄만 바꾸면 됩니다. (파일 안에 한국투자증권 API 예시 스켈레톤 주석으로 남겨뒀어요)

**자동 정산 배치 (`@nestjs/schedule` cron)**
- 5분마다: 마감시각이 지난 `OPEN` 게임 → `LOCKED` 전환
- 5분마다: `LOCKED` 게임의 시세를 조회해서 `settle()` 자동 실행 (2단계까지는 관리자가 수동으로 `/admin/games/:id/settle` 을 호출해야 했는데, 이제 자동화됨 — 수동 API는 그대로 남아있어서 필요하면 여전히 즉시 정산도 가능)
- 매일 09:00: 만료임박 쿠폰 텔레그램/카카오 알림

## 실행 방법 (1~2단계에 이어서)

```bash
npm install
npx prisma generate
npx prisma migrate dev --name add_coupons_notify
npx ts-node prisma/seed.ts   # 쿠폰 샘플 3종 추가 생성 (그 중 2개는 30일 이내 만료로 알림 테스트 가능)
npm run start:dev
```

## 빠른 테스트

```bash
# 텔레그램 알림 설정 (관리자 토큰으로)
curl -X PUT http://localhost:4000/admin/notify/settings \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"telegramToken":"<봇토큰>","telegramChatId":"<채팅ID>","telegramEnabled":true}'

# 지금 바로 만료임박 알림 보내기
curl -X POST http://localhost:4000/admin/notify/send-expiry-alert \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# 쿠폰 교환 (일반 유저) - 응답에서 code/expirySnapshot 바로 확인
curl -X POST http://localhost:4000/coupons/<COUPON_ID>/redeem \
  -H "Authorization: Bearer <USER_TOKEN>"
```

텔레그램 봇 토큰/채팅ID가 없다면: 텔레그램에서 @BotFather 로 새 봇을 만들면 토큰을 주고,
그 봇과 대화를 시작한 뒤 `https://api.telegram.org/bot<토큰>/getUpdates` 에 접속하면
`chat.id` 값을 확인할 수 있어요.

## 다음 단계 (4단계 예고)
- 관리자 대시보드 프론트엔드(지금까지의 API를 실제로 붙이는 화면), 감사로그(admin_audit_log)
- 부정거래/포인트 정합성 모니터링 배치, 부하테스트
- 법적 검토(사행성/전자금융거래법) 이후 정식 배포 준비

---

# 4단계: 감사로그 / 부정거래 모니터링 / 관리자 대시보드 / 배포 준비

## 추가된 기능

**감사로그**
- `/admin/**` 로 시작하는 모든 관리자 API 호출이 자동으로 `AuditLog`에 기록됩니다 (누가/언제/어떤 메서드+경로/어떤 body로 호출했는지). 코드를 한 줄도 추가하지 않아도 새로 만드는 관리자 API에 자동 적용됩니다.
- `GET /admin/audit-logs?limit=100`

**부정거래 · 정합성 모니터링**
- 매일 새벽 2시 배치가 3가지를 검사합니다: (1) `users.points` 캐시값과 `points_ledger` 합계 불일치, (2) 예측 10건 이상 참여자 중 적중률 80% 이상, (3) 같은 추천인 코드로 24시간 내 5명 이상 가입
- `GET /admin/fraud-alerts?resolved=false`, `POST /admin/fraud-alerts/run`(수동 실행), `PATCH /admin/fraud-alerts/:id/resolve`

**관리자 대시보드 (`admin-dashboard/index.html`)**
- 지금까지 만든 모든 관리자 API에 실제로 연결되는 화면입니다. 브라우저에서 파일을 그냥 열거나(더블클릭), 아무 정적 서버로 서빙하면 됩니다.
- 로그인 → 게임 생성/보너스/정산, 난이도 설정, 쿠폰 등록/삭제, 알림 설정/발송, 감사로그 조회, 부정거래 경고 확인/해결, 회원 목록까지 한 화면에서 처리 가능

**배포 준비**
- `Dockerfile`(멀티스테이지) + `docker-compose.yml`(API+PostgreSQL) 추가
- `helmet()` 보안 헤더, `@nestjs/throttler` 요청 속도제한(IP당 분당 120회) 적용
- `DEPLOYMENT.md` 에 실제 배포 전 체크리스트(비밀값 관리, 네트워크 구성, 법적 검토 등) 정리

## 실행 방법 (1~3단계에 이어서)

```bash
npm install
npx prisma generate
npx prisma migrate dev --name add_audit_fraud
npm run start:dev
```

그리고 `admin-dashboard/index.html` 파일을 브라우저로 열어서 API 주소(기본 http://localhost:4000)와
관리자 계정(`admin@test.com` / `admin1234`, seed로 생성됨)으로 로그인하면 바로 사용할 수 있습니다.

## Docker로 한 번에 띄우기 (선택)

```bash
cp .env.example .env   # JWT 시크릿 값 채우기
docker compose up -d --build
```

## 남은 것
`DEPLOYMENT.md` 체크리스트를 참고해서 실제 배포 전 비밀값 교체, 실시세 API 연동,
법적 검토(사행성 게임물 관련)를 반드시 진행해주세요.

---

# 5단계: 공지사항 팝업 / 실제 사용자 앱

## 추가된 기능
- **공지사항**: `Announcement` 테이블 + 관리자 API(`/admin/announcements`) + 공개 API(`GET /announcements/active`). 관리자 대시보드에 "📢 공지사항" 탭 추가.
- **텔레그램 만료 알림 시각을 오후 7시로 변경** (`scheduler.service.ts`)
- **관리자 대시보드 쿠폰 등록**: 이모지를 직접 타이핑하는 대신, 검색+클릭으로 고르는 아이콘 선택기 추가
- **`user-app/index.html`**: 지금까지 mock 데이터로만 동작하던 프로토타입과 달리, **실제 백엔드 API에 직접 연결되는 사용자 앱**입니다. 회원가입/로그인, 게임 목록, 난이도별 예측 제출, 지갑(포인트/예측내역), 쿠폰 교환(코드+유효기간 즉시 확인), 공지 팝업, 추천인 코드 공유까지 실제 서버와 통신합니다.

## 실행 방법 (1~4단계에 이어서)

```bash
npm install
npx prisma generate
npx prisma migrate dev --name add_announcements
npx ts-node prisma/seed.ts   # 이미 실행했다면 생략 가능
npm run start:dev
```

그 다음 `user-app/index.html` 을 브라우저로 열어서 API 주소(기본 http://localhost:4000)를 확인하고
회원가입해서 실제로 예측 제출 → 관리자 대시보드에서 정산 → 지갑에서 포인트 확인 →
쿠폰 교환까지 전체 흐름을 실제 DB로 테스트해볼 수 있습니다.

파일을 더블클릭해서 `file://`로 여는 게 안 되면(브라우저 보안 정책으로 fetch가 막히는 경우),
`npx serve user-app` 같은 간단한 정적 서버로 띄워서 열어주세요.

## 아직 안 만든 것 (다음 단계 후보)
- 출석체크(일일 10P·주간 50P·월간 300P) 백엔드 — 지금은 회원가입/추천인 보너스만 실서버에 있고, 출석 포인트는 예전 프로토타입에만 mock으로 있었습니다.
- 실제 결제/제휴사 연동 쿠폰 코드 자동 발급 (지금은 관리자가 수동으로 코드를 입력)
- 부정거래 경고가 쌓이면 관리자에게도 텔레그램으로 알림 (지금은 쿠폰 만료 알림에만 연결됨)

---

# 7단계: 출석체크 백엔드 / 휴대폰·구글 본인인증 / 닉네임

## 추가된 기능

**출석체크**
- `POST /attendance/check-in` — 하루 한 번 출석, +10P. `(userId, date)` 유니크 제약으로 동시에 여러 번 눌러도 중복 지급이 안 됩니다.
- 이번 주(월~일) 7일을 전부 출석하면 자동으로 +50P, 이번 달 전체를 출석하면 자동으로 +300P — 전부 `points_ledger`에 근거(`refId`=주/월 키)를 남겨서 같은 주/달에 두 번 지급되지 않게 막습니다.
- `GET /attendance/me` — 오늘 출석 여부, 이번 주 요일별 출석 현황, 이번 달 출석일수/목표일수
- `user-app`에 "📅 출석" 탭이 새로 생겼습니다.

**휴대폰 / 구글 본인인증 (어뷰징 방지)**
- 회원가입 시 **휴대폰 인증 또는 구글 인증 중 하나를 반드시 완료**해야 가입할 수 있습니다.
- `POST /auth/phone/send-code` → 6자리 인증번호 발송 (지금은 실제 SMS API가 없어서 서버 콘솔 로그에 출력되는 `MockSmsProvider` 사용 중 — 실 서비스 배포 전에 Twilio/알리고 같은 실제 SMS API로 교체해야 합니다. `src/verification/sms-provider.ts` 안에 교체 예시 주석이 있어요)
- `POST /auth/phone/verify-code` → 인증 성공 시 15분간 유효한 `verificationToken` 발급, 이 토큰을 회원가입 요청에 포함해야 합니다.
- 구글 인증은 `googleIdToken`(프론트에서 구글 로그인 버튼으로 받은 ID 토큰)을 서버가 구글 공개키로 직접 검증합니다. 이걸 쓰려면 `.env`에 `GOOGLE_CLIENT_ID`를 설정하고, 프론트에 구글 로그인 버튼을 붙여야 해요 (지금은 백엔드 API만 준비되어 있고, `user-app`에는 휴대폰 인증 UI만 붙여놨습니다).
- **핵심 방어 장치**: `User.phone`과 `User.googleSub`에 각각 `@unique` 제약을 걸어서, 같은 휴대폰번호나 같은 구글 계정으로는 두 번째 계정을 절대 만들 수 없게 DB 레벨에서 막았습니다. 이게 실제로 "불특정 다수의 가명 어뷰징"을 막는 핵심 장치예요 — 이메일만으로는 얼마든지 새로 만들 수 있지만, 진짜 휴대폰이나 진짜 구글 계정은 그렇게 쉽게 여러 개 만들 수 없으니까요.

**닉네임**
- `User.name`(실명)과 `User.nickname`(공개용 표시 이름)을 분리했습니다. `name`은 관리자 화면에서만 보이고, `/users/me` 같은 일반 API 응답에는 여전히 포함되지만 앞으로 다른 사용자에게 무언가를 보여줄 때(랭킹, 댓글 등)는 반드시 `nickname`만 쓰도록 설계했습니다.
- `nickname`도 이메일처럼 `@unique` — 중복 불가.

## 실행 방법 (1~6단계에 이어서)

```bash
npm install
npx prisma generate
npx prisma migrate dev --name add_verification_nickname_attendance
npm run start:dev
```

⚠️ **주의**: 기존에 이미 만들어둔 관리자 계정(`admin@test.com`)이나 테스트로 가입했던 계정들은
`nickname`이 없는 상태라 마이그레이션이 실패할 수 있어요. 로컬 테스트 단계라면 가장 간단한 방법은
DB를 초기화하고 다시 시작하는 겁니다:

```bash
npx prisma migrate reset   # DB를 완전히 비우고 마이그레이션+seed를 처음부터 다시 실행
```

## 테스트 흐름 (`user-app`)
1. 회원가입 화면에서 이름/닉네임/이메일/비밀번호 입력
2. 휴대폰번호 입력 → "인증번호" 버튼 → **서버 콘솔(`npm run start:dev` 띄운 터미널)에 찍히는 6자리 코드 확인**
3. 그 코드를 입력하고 "확인" → 인증 완료 메시지 확인
4. "가입하기" → 정상 가입되면 홈으로 이동
5. 같은 휴대폰번호로 다시 가입 시도 → "이미 이 휴대폰번호로 가입된 계정이 있습니다" 에러로 막히는 것 확인
6. "📅 출석" 탭에서 출석체크 → 포인트 +10 확인, 주간/월간 진행 상황 확인

---

# 8단계: 구글 가입의 어뷰징 구멍 막기

## 문제의식
구글 계정은 휴대폰과 달리 여러 개 만들기가 상대적으로 쉬워서, "구글 계정 여러 개 → 서로 추천인 코드 입력 → 추천 보너스 파밍"이 가능한 구조였습니다.

## 해결 방식
**포인트를 실제 가치로 바꾸는 지점(쿠폰 교환, 추천인 보너스)은 반드시 휴대폰 인증이 완료된 계정만 이용 가능**하도록 막았습니다. 구글 계정만으로는 게임 참여와 포인트 적립까지는 되지만, 그 이상은 막혀요.

- **회원가입**: 구글로 가입하면 `referredBy`(누가 추천했는지)는 기록해두지만, 추천인 보너스(신규 200P / 추천인 300P)는 **그 자리에서 지급하지 않고 보류**합니다.
- **`POST /auth/link-phone`**: 나중에 휴대폰을 인증해서 계정에 연결하면, 그 순간 보류돼 있던 추천인 보너스가 지급됩니다. (이미 지급된 적 있으면 중복 지급 안 되도록 원장을 확인합니다)
- **쿠폰 교환**: `POST /coupons/:id/redeem` 이 이제 `user.phone` 이 없으면 막습니다 — "휴대폰 인증이 완료된 계정만 이용할 수 있어요" 에러 반환.
- **`user-app` UI**:
  - 회원가입 화면 하단에 "구글 계정으로 계속하기" 버튼 → 누르면 **반드시 먼저 경고 팝업**이 뜹니다 ("쿠폰 교환·추천인 보너스는 휴대폰 인증 후에만 가능해요")
  - MY 탭에 휴대폰이 없는 계정이면 "📱 휴대폰 본인인증" 카드가 뜨고, 여기서 인증하면 쿠폰함/추천 보너스가 즉시 풀립니다
  - 쿠폰 탭도 휴대폰 미인증 상태면 빨간 배너로 안내하고 교환 버튼이 비활성화됩니다

## 구글 로그인을 실제로 테스트하려면
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 에서 OAuth 2.0 클라이언트 ID(웹 애플리케이션)를 발급받으세요. 승인된 자바스크립트 원본에 `user-app` 을 서빙하는 주소(예: `http://localhost:5500`)를 등록해야 합니다.
2. 서버 `.env` 의 `GOOGLE_CLIENT_ID` 에 그 값을 넣으세요.
3. `user-app/index.html` 상단의 `const GOOGLE_CLIENT_ID = '';` 에도 **같은 값**을 넣으세요.
4. `user-app` 을 `file://` 로 직접 열지 말고 정적 서버로 띄워주세요 (`npx serve user-app`) — 구글 로그인은 `file://` origin을 허용하지 않습니다.

## 실행 방법 (1~7단계에 이어서)
```bash
npm install
npx prisma generate
npx prisma migrate dev --name defer_referral_gate_coupon
npm run start:dev
```

---

# 9단계: 구글 가입 제거 / 비밀번호 확인 / 쿠폰 발급 시 자동 문자 발송

## 변경 사항

**구글 계정 가입 삭제**
- 어뷰징 여지가 큰 구글 가입 경로를 완전히 제거했습니다. 이제 **가입은 휴대폰 인증 하나로만** 가능합니다 (`SignupDto.phoneVerificationToken` 필수).
- 관련 코드 정리: `GoogleAuthService`, `google-auth-library` 의존성, `User.googleSub` 컬럼, `user-app`의 구글 버튼/동의 팝업/스크립트 로딩 로직을 전부 제거했습니다.
- `POST /auth/link-phone` 은 그대로 남겨뒀습니다 — 관리자가 직접 만든 계정처럼 휴대폰 없이 생성된 특수 계정이 나중에 인증을 추가할 때 쓰는 범용 유틸리티로 유지됩니다.

**회원가입 비밀번호 확인**
- `user-app` 회원가입 화면에 "비밀번호 확인" 입력란을 추가했습니다. 제출 전 클라이언트에서 두 값이 일치하는지 검사하고, 다르면 "비밀번호가 일치하지 않아요" 에러를 보여주고 서버에 요청을 보내지 않습니다.

**쿠폰 구매 시 자동 문자 발송**
- 가입이 휴대폰 인증 필수로 바뀌면서, 이제 쿠폰을 교환할 수 있는 모든 계정은 자동으로 휴대폰이 인증된 상태입니다 (기존에 만들어둔 계정 보호를 위해 `coupons.service.ts`의 `if (!user.phone)` 방어 로직은 그대로 남겨뒀습니다).
- `POST /coupons/:id/redeem` 성공 시, **인증된 휴대폰번호로 쿠폰명·쿠폰번호·사용 포인트·유효기간을 담은 문자를 자동 발송**합니다 (`SmsProvider.sendMessage`). 지금은 `MockSmsProvider`라 실제 문자 대신 서버 콘솔에 로그로 찍히고, 실제 SMS API로 교체하면 그대로 진짜 문자가 나갑니다.
- 문자 발송은 DB 트랜잭션이 끝난 뒤 별도로 실행해서, 문자 발송이 실패해도 이미 완료된 쿠폰 교환 자체에는 영향이 없습니다 (실패 시 서버 로그에만 남습니다).

## 실행 방법 (1~8단계에 이어서)
```bash
npm install
npx prisma generate
npx prisma migrate dev --name remove_google_auth
npm run start:dev
```

⚠️ `googleSub` 컬럼을 스키마에서 제거했기 때문에, 기존 DB에 이미 구글 관련 데이터가 있었다면
마이그레이션 시 컬럼 삭제가 발생합니다. 로컬 테스트 단계라면 `npx prisma migrate reset` 으로
초기화하고 시작하는 걸 권장합니다.

## 테스트 방법
1. `user-app` 회원가입 화면에서 비밀번호와 비밀번호 확인을 다르게 입력 → "비밀번호가 일치하지 않아요" 확인
2. 정상적으로 휴대폰 인증까지 완료하고 가입
3. 쿠폰 탭에서 쿠폰 교환 → 성공 응답으로 코드가 화면에 뜨는 것 확인
4. 서버를 띄운 터미널 콘솔을 확인 → `[MOCK SMS] 010-XXXX-XXXX 로 문자 발송: "[종가예측게임] ... 쿠폰번호: ..."` 로그가 찍히는지 확인
