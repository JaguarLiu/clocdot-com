# ClocDot

[繁體中文](README.md) | [English](README.en.md)

ClocDot 是為中小企業設計的多租戶人資、差勤與薪資管理系統。涵蓋打卡、排班、請假、加班、簽核、組織權限、薪資結算及薪資單。

目前預設時區為 `Asia/Taipei`，並內建 2026 年台灣國定假日與勞健保／勞退參考資料。

> 

## 主要功能

### 員工端

- Email／密碼登入、修改密碼
- 上下班打卡及當日狀態
- GPS、公司地點半徑與 Wi-Fi IP/CIDR 現場驗證
- 離線打卡佇列與 PWA 安裝
- 出勤歷史、異常狀態及補卡申請
- 請假申請、餘額查詢、取消申請及公司假勤日曆
- 加班時數推導、申請及法規提示
- 主管待簽核工作匣
- 個人薪資單
- 繁體中文／英文介面

### 管理後台

- 今日出勤概況、月報與年度統計
- 出勤、補卡、請假及加班審核
- Excel／CSV 報表匯出
- 員工建立、編輯、停用、解鎖及批次匯入
- 部門樹、部門主管、角色與模組權限
- 班別管理、預設班別及每日排班
- 公司工作日、例假／休息日及特殊日期設定
- 公司地點、現場週期及 Wi-Fi 打卡設定
- 假別額度、扣薪比例與週年制／曆年制設定
- 薪資資料、月薪／時薪、津貼、投保資料及自願提繳
- 月薪資批次、人工調整、特休結清、鎖定與匯出
- 問題回報

### 後端能力

- 公司層級的多租戶資料隔離
- JWT 認證、帳號狀態檢查及登入限流／漸進式鎖定
- 部門範圍與模組層級 RBAC
- 沿部門組織樹建立的多層簽核流程
- 交易式簽核決議與重複執行防護
- 台灣加班、休息日、例假及七休一等合規檢查
- Redis 快取與 rate-limit；Redis 無法使用時可降級運作
- 請求 schema 驗證、安全 headers 及通用錯誤處理

## 技術選型

| 層級 | 技術 |
|---|---|
| 員工端 | React 19、Vite 8、Tailwind CSS 4、SWR、React Router、i18next |
| PWA | vite-plugin-pwa、Workbox |
| 管理端 | React 19、Vite 8、SWR、ExcelJS |
| API | Node.js 22、Fastify 5 |
| ORM／資料庫 | Prisma 7、PostgreSQL |
| 快取 | Redis／ioredis |
| 認證 | Email + password、JWT、bcrypt |
| 部署 | Docker、Caddy |

## 系統架構

```mermaid
flowchart LR
  Employee[員工] --> Client[React PWA\nclient/]
  Manager[HR／主管] --> Admin[React Admin\nadmin/]
  Client -->|REST /api| API[Fastify API\nserver/]
  Admin -->|REST /api| API
  API --> DB[(PostgreSQL)]
  API --> Redis[(Redis)]
```

三個 workspace 共用同一套 API 與資料庫：

```text
Clocdot/
├── client/                 員工 PWA
│   └── src/
│       ├── pages/          打卡、歷史、補卡、請假、加班、薪資單
│       ├── components/     共用 UI 與 PWA 元件
│       ├── context/        登入狀態
│       ├── hooks/          出勤、網路及安裝狀態
│       └── services/       API、認證與離線佇列
├── admin/                  管理後台
│   └── src/
│       ├── pages/          報表、審核、員工、排班、薪資、設定
│       ├── components/     組織圖、員工／班別／薪資編輯元件
│       └── services/       API 與認證
├── server/
│   ├── src/
│   │   ├── routes/         Fastify REST endpoints
│   │   ├── services/       差勤、假勤、簽核、法遵與薪資邏輯
│   │   ├── plugins/        Prisma、Redis、JWT、i18n
│   │   ├── data/           台灣假日及薪資級距資料
│   │   └── utils/          時區、租戶、IP、CSV 等工具
│   ├── prisma/             Schema、migration 與資料修正 SQL
│   └── test/               Node.js 測試
├── docker-compose.yml
└── Makefile
```

## 主要資料模型

資料以 `Company` 作為租戶邊界，主要關係如下：

```mermaid
erDiagram
  Company ||--o{ User : employs
  Company ||--o{ Department : contains
  Company ||--o{ Role : defines
  Company ||--o{ Shift : defines
  Company ||--o{ CompanyLocation : owns
  Company ||--o{ LeavePolicy : configures
  User ||--o{ AttendanceRecord : records
  User ||--o{ LeaveRequest : requests
  User ||--o{ OvertimeRequest : requests
  User ||--o{ ShiftAssignment : receives
  User ||--o| SalaryProfile : has
  AttendanceRecord ||--o{ CorrectionRequest : corrects
  PayrollRun ||--o{ PayrollItem : contains
```

完整欄位與約束請以 [`server/prisma/schema.prisma`](server/prisma/schema.prisma) 為準。

## 本機開發

### 前置需求

- Node.js 22.9 以上
- npm 11
- PostgreSQL
- Redis（選用；未設定時快取與 Redis rate-limit 會停用）

### 安裝與設定

```bash
npm ci
cp .env.example server/.env
```

至少需要在 `server/.env` 設定有效的 PostgreSQL 連線及隨機 JWT secret：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clocdot?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=3000
```

`JWT_SECRET` 未設定或仍使用舊的開發預設值時，Server 會拒絕啟動。

產生 Prisma Client 並套用 migration：

```bash
npm run db:generate --workspace @clocdot/server
npm run db:migrate --workspace @clocdot/server
```

全新資料庫套用 migration 後，設定第一間公司與管理員資料：

```env
# server/.env
BOOTSTRAP_COMPANY_NAME="Example Company"
BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
BOOTSTRAP_ADMIN_NAME="System Administrator"
```

接著執行一次性 bootstrap；程式會在終端機安全提示輸入至少 12 碼的密碼，不會顯示輸入內容，並要求覆誦一次以避免打錯：

```bash
npm run bootstrap:admin
```

此流程會在單一 transaction 中建立 Company、Admin Role 與第一位管理員。同一管理員重跑不會修改資料；若公司已有其他管理員，或 `BOOTSTRAP_COMPANY_NAME` 命中的既有公司底下已經有使用者，都會拒絕執行——後者是為了避免打錯公司名時，把管理權授予另一個同名租戶的出勤與薪資資料。非互動式部署可暫時以 `BOOTSTRAP_ADMIN_PASSWORD` 傳入密碼（此時會略過提示與覆誦），執行後應立即從環境與 secret store 移除。

### 啟動服務

```bash
# 員工端（localhost:5173）與 API（localhost:3000）
npm run dev

# 管理後台（localhost:5174）
npm run dev:admin
```

也可以分別啟動：

```bash
npm run dev:client
npm run dev:server
npm run dev:admin
```

Vite 開發伺服器會把 `/api` proxy 到 `http://localhost:3000`。

## 環境變數

完整範例位於 [`.env.example`](.env.example)。

### Server

| 變數 | 必要 | 說明 |
|---|---:|---|
| `DATABASE_URL` | 是 | PostgreSQL connection string |
| `JWT_SECRET` | 是 | JWT 簽章密鑰；正式環境請使用長隨機值 |
| `PORT` | 否 | API port，預設 `3000` |
| `REDIS_URL` | 否 | Redis connection string |
| `CORS_ORIGINS` | 正式環境必要 | 允許來源，以逗號分隔，須含 client 與 admin 的對外網址。未設定時 fallback 為 `CLIENT_URL`，再退回 `http://localhost:5173,http://localhost:5174`，正式環境等同全部被擋 |
| `TRUST_PROXY` | 反向代理後必要 | 是否信任 `X-Forwarded-For`。未設定＝不信任（僅用連線來源 IP）；數字＝反向代理跳數；亦可填逗號分隔的 proxy IP/CIDR。`request.ip` 是 Wi-Fi 打卡的判準，設成 `true` 會讓用戶端可自行偽造來源 IP |
| `GOOGLE_MAPS_API_KEY` | 否 | 地址 geocoding |
| `BOOTSTRAP_COMPANY_NAME` | bootstrap 時 | 第一間公司名稱；僅 `npm run bootstrap:admin` 使用 |
| `BOOTSTRAP_ADMIN_EMAIL` | bootstrap 時 | 第一位管理員 email |
| `BOOTSTRAP_ADMIN_NAME` | bootstrap 時 | 第一位管理員姓名 |
| `BOOTSTRAP_ADMIN_PASSWORD` | 否 | 僅供非互動式自動化；設定後會略過終端機提示，用完應立即移除 |

### Client／Admin build-time

| 變數 | 應用 | 說明 |
|---|---|---|
| `VITE_API_BASE` | 兩者 | API base URL，開發環境通常為 `/api` |
| `VITE_ADMIN_URL` | Client | 管理後台網址 |
| `VITE_CLIENT_URL` | Admin | 員工端網址 |

## 常用指令

```bash
# Build
npm run build

# Lint
npm run lint

# Test
npm test

# Prisma
npm run db:migrate
npm run db:push
npm run db:studio
```

測試使用 Node.js 內建 test runner，核心覆蓋簽核競態、租戶／組織範圍、排班合規、假勤、加班、薪資計算、登入鎖定、i18n 與 route schema。

## Docker

根目錄提供 PostgreSQL、Redis、API、員工端及管理端的 Compose 設定：

```bash
export JWT_SECRET="replace-with-a-long-random-secret"
docker compose up -d --build
```

預設對外 port：

- Client：`http://localhost:80`
- Admin：`http://localhost:8080`
- API：`http://localhost:3000`
- PostgreSQL：`localhost:5433`
- Redis：`localhost:6379`

亦可使用 `make up-build`、`make logs`、`make ps` 等快捷指令。

正式環境把 client / admin / server 分別部署成獨立網域時，務必依實際網域設定 server 的 `CORS_ORIGINS`（見上方環境變數），否則前端請求會被 CORS 擋掉。

## 安全與資料注意事項

- API 預設透過租戶、部門範圍與模組權限限制資料存取。
- 密碼使用 bcrypt 雜湊，JWT 有效期目前為一天。
- 員工停用後，既有 JWT 會在後續請求被拒絕。
- 生產環境必須設定獨立且不可預測的 `JWT_SECRET`。
- 出勤和薪資屬敏感資料；正式部署前應建立 PostgreSQL 備份、還原演練、監控及稽核紀錄策略。
- `server/src/data/twHolidays` 與 `server/src/data/twPayroll` 是年度資料，跨年度前需更新並驗證。
- 台灣勞動法規與薪資級距資料僅為方便對照之參考，不構成法律意見；實際適用請洽專業人士並以主管機關公告為準。

## API 概覽

API 統一使用 `/api` prefix，主要資源包含：

- `/api/auth`：登入、目前使用者、修改密碼
- `/api/attendance`、`/api/punch-in`、`/api/punch-out`：出勤與打卡
- `/api/correction-requests`：補卡
- `/api/leave-requests`、`/api/leave-balances`：請假
- `/api/overtime-requests`：加班
- `/api/approvals`：主管簽核
- `/api/payroll/me`：個人薪資單
- `/api/admin/*`：報表、員工、組織、設定與薪資管理
- `/api/admin/shifts`、`/api/admin/schedule`：班別與排班
- `/api/health`：服務檢查

路由的實際 request schema 與授權條件請以 [`server/src/routes`](server/src/routes) 為準。

## 專案狀態與維護

| 項目 | 現況 |
|---|---|
| 維護者 | [@JaguarLiu](https://github.com/JaguarLiu) |
| 問題回報 | [GitHub Issues](https://github.com/JaguarLiu/clocdot-com/issues)（安全性問題請走 [SECURITY.md](SECURITY.md)） |


### 已知限制

- 未內建稽核日誌（誰在何時查看或修改了哪筆薪資紀錄）。
- 沒有資料保存期限或自動刪除機制，個資刪除需直接操作資料庫，詳見 [PRIVACY.md](PRIVACY.md)。
- 自動化測試集中在後端業務邏輯；前端與端對端流程尚未有瀏覽器整合測試。
- 台灣假日與勞健保級距為年度資料，跨年度需手動更新，詳見 [`server/src/data/README.md`](server/src/data/README.md)。
- 僅支援單一時區（`Asia/Taipei`）與繁體中文／英文兩種介面。
- 本倉庫**不含**示範帳號、種子資料或截圖；請以自己的測試資料建立環境。

## 隱私與資料處理

本系統處理位置、IP、出勤與薪資等個人資料。**部署者是個資的蒐集者與保有者**，
請先閱讀 [PRIVACY.md](PRIVACY.md) 了解系統實際會收集、快取與保存哪些資料，再據以撰寫隱私政策。

## 參與貢獻與安全性

提交變更前請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md) 與 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。安全漏洞請依 [SECURITY.md](SECURITY.md) 私下回報，不要在公開 issue 張貼利用方式或敏感資料。

## 授權

ClocDot 及專案原創視覺素材依 [Apache License 2.0](LICENSE) 授權發布；相關聲明見 [NOTICE](NOTICE)。
