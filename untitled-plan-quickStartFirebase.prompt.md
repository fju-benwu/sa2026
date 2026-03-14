我將把計畫更新為以 Firebase 為預設的快速上手（MVP）方案，並根據你的回覆調整需求：

TL;DR
建議以 Firebase（Firestore + Auth + Hosting）作為 MVP 起點（你選擇由我建議 BaaS），並支援完整管理 UI；預設支援登入方式：Email/Password、Google、Magic Link。離線需求目前未決，我在下方列出兩種處理選項供你選。

目標功能（依你的選擇已擴充管理功能）
- 使用者登入（Email/Password、Google、Magic Link）
- 學生報名發言（加入隊列）
- 隊列列表（即時更新、排序）
- 管理者（teacher/admin）操作：標記完成、調整順序、移除、插隊、批次操作
- 稽核紀錄（audit_logs）
- 權限控管（使用者只能建立自己的報名；管理者擁有額外操作權限）

高階步驟（已依你的選擇更新）
1. 建立 Firebase 專案並啟用 Authentication 與 Firestore
2. 啟用登入方式：Email/Password、Google、Email Link（Magic Link）
3. 在 Firestore 建立集合：`speeches`、`audit_logs` 並撰寫安全規則（含 admin custom claims）
4. 本地 scaffold 前端：Next.js（App Router），安裝 Firebase SDK
5. 實作核心前端頁面與組件（App Router 架構）：`app/layout.jsx`、`app/page.jsx`、`components/Auth.jsx`、`components/Queue.jsx`、`components/AdminPanel.jsx`，並使用 Firestore `onSnapshot` 訂閱以達成即時更新
6. 使用 Firebase Emulator 測試 Rules 與流程（強烈建議）
7. 部署至 Firebase Hosting（或 Vercel/Netlify）
8. 建立 CI（GitHub Actions）與 E2E（Playwright 建議）

離線策略（你表示尚未決定，提供兩種選項）
- 輕量離線（建議，快速）：使用 Firestore 的內建離線快取（讀取快取、離線寫入會在連線復原時同步）。適合短暫斷線、不需複雜衝突處理的情況。
- 進階離線（選項）：前端使用 localForage 或 IndexedDB 暫存使用者操作，並在恢復網路時把變更推到後端，需設計衝突解決（例如時間戳或服務端合併規則）。若需這個我會在 scaffold 中加入同步邏輯範例。

建議資料模型（Firestore）
- `speeches` documents:
  - `userId` (string)
  - `displayName` (string)
  - `createdAt` (timestamp)
  - `status` ("waiting" | "speaking" | "done")
  - `notes` (string, optional)
  - `moderatorId` (string, optional)
  - `done_at` (timestamp, optional)
- `audit_logs` documents:
  - `action`, `actorId`, `targetId`, `ts`, `meta`

安全規則（簡易示例）
service cloud.firestore {
  match /databases/{database}/documents {
    match /speeches/{id} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null;
      allow update: if request.auth != null && (
        (request.auth.uid == resource.data.userId && request.resource.data.userId == request.auth.uid)
        || (request.auth.token.admin == true)
      );
      allow delete: if request.auth != null && request.auth.token.admin == true;
    }
    match /audit_logs/{doc} {
      allow write: if request.auth != null && request.auth.token.admin == true;
      allow read: if request.auth != null && request.auth.token.admin == true;
    }
  }
}

前端最小檔案（Next.js + App Router 建議）
- `lib/firebaseClient.js` 或 `src/firebaseClient.js`：初始化 Firebase，export `auth` 與 `db`（使用 `process.env.NEXT_PUBLIC_...`）
- `app/layout.jsx`：Next App Router 的全域 layout（引入樣式、Auth provider）
- `app/page.jsx`：首頁，展示隊列或登入入口
- `app/(auth)/login/page.jsx`：登入頁面（Email/Google/Magic Link）
- `components/Auth.jsx`：登入/登出、onAuthStateChanged（放於 `components/`）
- `components/Queue.jsx`：顯示隊列、加入報名、onSnapshot 訂閱
- `components/AdminPanel.jsx`：管理介面（調整順序、批次移除、標記完成）
- `.env.local`：`NEXT_PUBLIC_FIREBASE_API_KEY` 等環境變數
- `firebase.json`：Hosting / emulator 配置
- `.github/workflows/ci.yml`：CI 範本（包含測試與部署）

關鍵前端程式片段（可直接複製）
初始化（Next.js）
```
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```
新增報名
```
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
await addDoc(collection(db, 'speeches'), { userId: uid, displayName: name, status: 'waiting', createdAt: serverTimestamp(), notes: notes || '' });
```
監聽隊列（Realtime）
```
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
const q = query(collection(db, 'speeches'), orderBy('createdAt','asc'));
const unsub = onSnapshot(q, (snapshot) => {
  const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  // 更新 UI
});
// 取消訂閱：unsub();
```
標記完成
```
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
await updateDoc(doc(db, 'speeches', speechId), { status: 'done', done_at: serverTimestamp(), moderator_id: adminUid });
```

本地與部署指令（Next.js）
```
# 建立 Next.js App（App Router）
npx create-next-app@latest myapp --use-npm --experimental-app
cd myapp
npm install
npm install firebase

# 開發
npm run dev

# Firebase emulators（選用）
firebase login
firebase init emulators
firebase emulators:start

# 部署
npm run build
npm run start
firebase deploy --only hosting
```

測試建議（已選 Playwright 作為 E2E）
- Unit/Component：Vitest + React Testing Library
- Mock/API：MSW（模擬 Firebase 或測試場景）
- E2E：Playwright（已選）
- Accessibility：axe-core

Playwright 實作要點
- 使用 Firebase Emulator Suite 測試 Auth 與 Firestore（避免連到 production）。
- 在測試前透過 Emulator API 或 Admin SDK 建立測試帳號並以程式方式簽入，避免在每次 E2E 做完整 UI 登入，減少 flakiness。
- 啟用 artifact（trace、video、screenshot）：在 `playwright.config.ts` 開啟 `trace: 'on-first-retry'`、`video: 'retain-on-failure'` 以便失敗時取得診斷資料。

Playwright 快速安裝與執行
```
npm install -D @playwright/test
npx playwright install
# 執行所有測試
npx playwright test
```

Playwright 範例（最小 E2E，Next.js）
```
import { test, expect } from '@playwright/test'
test('student can register', async ({ page }) => {
  await page.goto('http://localhost:3000')
  // 假設已用 emulator 建立 session 或用 API 登入
  await page.fill('[name=note]', '我要發言')
  await page.click('text=報名')
  await expect(page.locator('text=我要發言')).toBeVisible()
})
```

GitHub Actions（Playwright + Firebase Emulator）簡要範例
```
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: firebase emulators:start --only auth,firestore --project emu --import=./emulator-data &
      - run: npx playwright test --reporter=list
      - if: failure()
        run: npx playwright show-trace trace.zip
```

測試策略要點
- 在 E2E 中優先測試關鍵流程：Auth、加入隊列、admin 批次操作（批次移除）、拖放調整順序。 
- 使用 MSW 或 emulator 來控制後端回應，確保測試穩定且可重現。
- 在 CI 設定適度的 retries 與收集 artifacts，排查不穩定測試。

取捨與建議（根據你的選擇）
- 以 Firebase 起步能最快達成 MVP、支援即時與輕量離線，且能快速加上 Google 與 Email/Magic Link 登入。
- 若未來需要複雜 SQL 查詢或更細緻的 RLS，考慮後期遷移至 Supabase。

決策紀錄（依你回覆已確認）
- BaaS：同意以 Firebase 作為 MVP 起點（Firestore + Auth + Hosting）。
- 離線策略：選 A — 輕量離線（使用 Firestore 內建離線快取）。
- 管理功能：需支援「拖放（手動調整順序）」與「批次移除」；同時保留一般的標記完成與移除功能。
- 登入方式：保留 `Email / 密碼`、`Google SSO` 與 `Magic Link（Email）`。
- Scaffold：目前暫不 scaffold（使用者決定稍後再開始）。
- **Bundler**: Turbopack（2026年3月11日最新決策）— 已啟用為預設開發伺服器；webpack 保留為回退。
- **Firebase 版本**: ^11.0.0（已升級並驗證功能）。

後續
- 我已把你的決策寫入此計畫檔案；目前待辦為「Scaffold Firebase MVP（可選）」。
- 當你準備好讓我 scaffold 時，請回覆 `開始 scaffold`（或 `scaffold 測試` 以僅 scaffold 測試環境）。

如需我現在匯出或產生 CSV 格式的決策摘要，也可告訴我，我會建立一個 `DECISIONS.md` 檔案。
