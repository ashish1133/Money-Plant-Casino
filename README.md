# 🎰 Lucky Casino - Premium Gaming Experience

An end‑to‑end demo casino platform: rich animated frontend + Node.js/Express backend (SQLite) with authentication (Firebase), wallet, progression (XP & levels), achievements, leaderboards, and provably fair gameplay.

## 🎮 Frontend Features

### Games
| Game | Mechanics | Notes |
|------|-----------|-------|
| Slots | 3 reels, symbol matching | Server authoritative RNG + seed/hash for fairness |
| Roulette | Color bet (red/black/green) | Payouts 2x / 2x / 14x (example) |
| Blackjack | Dealer vs player | Hit / Stand flows with server-side deck state |

### UI / UX
- ✨ Responsive neon/dark luxury theme (Orbitron + Roboto)
- 🌀 Animated metrics, live ticker, heatmap, spotlight events
- 🧩 Accessible focus styles & keyboard trapping in modals
- 🏆 Achievements + stats + leaderboard modals
- 📊 XP bar with dynamic level progression
- ⚖ Provably fair verification (seed/hash validity check)

### Economy / Meta
- 💳 Wallet: deposit, withdraw, transaction history (persisted)
- 📈 XP gain per wager, level thresholds (1000 XP per level)
- 🏆 Achievements (first win, streaks, big win, mastery, etc.)
- 🔁 Daily bonus with streak scaling
- 🥇 Leaderboards: net profit, level, per‑game profit

## 🔧 Backend Features
- Node.js + Express server (`server/`)
- SQLite via better-sqlite3 (fast synchronous queries)
- Auth: Firebase Authentication (client-side); backend verifies Firebase ID tokens
- Services split by domain (`services/*`): wallet, games, progression, leaderboard
- Provably Fair RNG (`utils/fairRNG.js`): seed + HMAC hash exposure + verification endpoint
- Middleware: authentication, rate limiting, helmet, CORS (multi-origin)
- Structured logging (Winston) & error handling
- Progression and achievement unlocking integrated into game results

## 🗂 Firestore Registration Mirroring
- On signup, login, and social sign-in, the app writes a registration document to Firestore in collection `registure_users` with fields: `uid, email, name, phone, age, gender, provider, createdAt, updatedAt`.
- Collection can be overridden via `<meta name="register-collection" content="...">` (set in `userlogin/index.html`). Default is `registure_users`.
- Rules (publish in Firebase Console → Firestore → Rules):
```rules
rules_version = '2';
service cloud.firestore {
   match /databases/{database}/documents {
      match /registure_users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
      }
   }
}
```
- UI: After login, click “My Registration” in the header to view your doc.

## 🌐 API Overview (High Level)
| Endpoint | Method | Description |
|----------|--------|-------------|
| (Auth handled by Firebase) |  | Attach `Authorization: Bearer <Firebase ID token>` |
| `/api/wallet/deposit` | POST | Add funds |
| `/api/wallet/withdraw` | POST | Remove funds |
| `/api/wallet/transactions` | GET | Paginated transaction list |
| `/api/games/slots` | POST | Play slots round |
| `/api/games/roulette` | POST | Play roulette round |
| `/api/games/blackjack` | POST | Deal / Hit / Stand (action param) |
| `/api/games/verify` | POST | Validate seed/hash combo |
| `/api/users/profile` | GET | User profile + progression snapshot |
| `/api/users/stats` | GET | Aggregated gameplay stats |
| `/api/users/achievements` | GET | Achievement list |
| `/api/users/daily-bonus` | POST | Claim daily bonus |
| `/api/users/leaderboard` | GET | Leaderboard by type/game |

## 🧩 Dynamic API Base URL
Frontend auto-detects backend base via `api-client.js` priority:
1. `window.API_BASE_URL` global (define before scripts)
2. `<meta name="api-base" content="https://your-backend-domain/api">`
3. `localhost` fallback when hostname is `localhost`
4. Same-origin `/api` for combined deployment

Add in `index.html` head for production:
```html
<meta name="api-base" content="https://casino-backend.example/api">
```
Or inline before loading scripts:
```html
<script>window.API_BASE_URL='https://casino-backend.example/api';</script>
```

## 🚀 Quick Start (Local Full Stack)
```bash
git clone https://github.com/ashish1133/Money-Plant-Casino.git
cd Money-Plant-Casino
cp .env.example .env   # edit secrets, origins
cd server
npm install            # install backend dependencies
node server.js         # starts API on :3000
```
Open `index.html` directly (or serve with VS Code Live Server / simple HTTP) — API calls hit `http://localhost:3000/api`.

### Docker
```bash
docker compose up --build -d
```
Backend: `http://localhost:3000/api` (static frontend also served). The dynamic base picks same-origin `/api` when accessed through the container host mapping.

### Environment Variables (`.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Backend port (default 3000) |
| `CORS_ORIGINS` | Comma-separated allowed origins (frontend URLs) |
| `DB_PATH` | Path to DB file (default `./database/casino.db`) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` | Firebase Admin credentials for verifying ID tokens |

### Multi-Origin CORS
Set `CORS_ORIGINS=https://casino.example,https://pages.example` to allow both deployments. Requests from other origins are rejected.

## 🎯 Gameplay Summary

### Slot Machine
1. Set your bet amount (minimum $10)
2. Click "SPIN" to spin the reels
3. Match symbols to win:
   - Three of a kind: 5x multiplier (special symbols have higher multipliers)
   - Two of a kind: 2x multiplier

### Roulette
1. Set your bet amount
2. Choose Red, Black, or Green
3. Click "SPIN" and wait for the result
4. Win multipliers:
   - Red/Black: 2x
   - Green: 10x

### Blackjack
1. Set your bet amount
2. Click "Deal" to start
3. Click "Hit" to get another card
4. Click "Stand" when you're satisfied
5. Beat the dealer without going over 21!

### Deposits & Withdrawals
1. Click Deposit or Withdraw in the top bar.
2. Enter an amount (minimum $10).
3. Submit to adjust your balance.
4. Recent transactions are logged (latest 15).
5. Large deposits ($1000+) trigger a celebration effect.

Constraints:
- Withdrawals cannot exceed current balance.
- All amounts are integers; balance resets on page refresh.

## 💡 Tips

- Start with smaller bets to learn the games
- Watch your balance - manage it wisely!
- Each game has different odds and strategies
- Have fun and play responsibly!

## 🛠️ Tech Stack
- Frontend: HTML5 / CSS3 / Vanilla JS
- Backend: Node.js + Express + better-sqlite3
- Auth: Firebase Authentication (ID tokens)
- RNG: Seed + hash for provable fairness
- Logging: Winston
- Rate limiting: `express-rate-limit`
- Docker / Compose for containerized deployment

## 📝 Notes & Disclaimers
- Entertainment / demo only – no real gambling.
- RNG & fairness logic provided for educational purposes.
- Never commit secrets; keep Firebase Admin keys secure.
- Configure HTTPS + secure cookie flags if extending auth scope.
- Implement KYC / AML / responsible gaming features for any real deployment.

## 🎨 Customization
Edit:
- Theme tokens in `styles.css` (`:root` variables)
- Game math & payouts in `server/services/gameService.js`
- Progression thresholds in `progressionService.js`
- Achievements definitions in corresponding service (extend criteria)
- Frontend animations / cards / metrics in `script.js`

Add new game: create service + route under `server/services` & `server/routes`, expose endpoint, integrate UI modal.

## ✅ Deployment Checklist
1. Configure Firebase Admin credentials in `.env` (service account)
2. Configure `CORS_ORIGINS` with final frontend domains
3. Persist SQLite database directory (e.g., `server/database`) as a volume in Docker
4. Add automated backups / migrations if scaling
5. Serve over HTTPS (reverse proxy: Nginx / Caddy / cloud host)
6. Monitor logs (stdout aggregation or external service)
7. Optionally add CI for lint/test & tagging releases

## 🛠 Admin Dashboard

Two options:
- Firebase Realtime Admin: `http://localhost:3000/adminfire/` (reads Firestore directly; requires Firebase admin custom claim).
- Server-backed Admin: `http://localhost:3000/admin/` (aggregates from SQLite; protected by Firebase ID token with `admin` claim). All requests must include `Authorization: Bearer <Firebase ID token>`.
## 📄 License

Open source for personal & educational use. Not for real-money gambling without proper legal compliance.

---

**Enjoy your gaming experience at Lucky Casino! 🎰🎲🃏**

