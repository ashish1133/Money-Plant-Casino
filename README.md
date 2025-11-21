# 🎰 Lucky Casino - Premium Gaming Experience

An end‑to‑end demo casino platform: rich animated frontend + Node.js/Express backend (SQLite) with authentication, wallet, progression (XP & levels), achievements, leaderboards, and provably fair gameplay.

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
- Auth: JWT access + refresh tokens, secure refresh flow
- Services split by domain (`services/*`): auth, wallet, games, progression, leaderboard
- Provably Fair RNG (`utils/fairRNG.js`): seed + HMAC hash exposure + verification endpoint
- Middleware: authentication, rate limiting, helmet, CORS (multi-origin)
- Structured logging (Winston) & error handling
- Progression and achievement unlocking integrated into game results

## 🌐 API Overview (High Level)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account (returns tokens) |
| `/api/auth/login` | POST | Authenticate |
| `/api/auth/refresh` | POST | Refresh access token |
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
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Long random secrets for signing tokens |
| `SQLITE_DB_PATH` | Path to DB file (e.g. `./data/casino.db`) |
| `ACCESS_TOKEN_EXPIRY` | e.g. `15m` |
| `REFRESH_TOKEN_EXPIRY` | e.g. `7d` |

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
- Auth: JWT (access + refresh) with secure rotation
- RNG: Seed + hash for provable fairness
- Logging: Winston
- Rate limiting: `express-rate-limit`
- Docker / Compose for containerized deployment

## 📝 Notes & Disclaimers
- Entertainment / demo only – no real gambling.
- RNG & fairness logic provided for educational purposes.
- Replace secrets in production; never commit real JWT keys.
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
1. Set real JWT secrets in `.env`
2. Configure `CORS_ORIGINS` with final frontend domains
3. Persist SQLite `./data` directory (volume in Docker)
4. Add automated backups / migrations if scaling
5. Serve over HTTPS (reverse proxy: Nginx / Caddy / cloud host)
6. Monitor logs (stdout aggregation or external service)
7. Optionally add CI for lint/test & tagging releases

## 🛠 Admin Dashboard (Unauthenticated Demo)

An unsecured admin dashboard has been added under `admin/` for demonstration purposes.

Access:
```
http://localhost:3000/admin/
```
Endpoints exposed (no auth):
- `GET /api/admin/overview` – aggregate counts (users, balances sum, transactions, games, profit)
- `GET /api/admin/users?limit=100` – recent users with balance & progression
- `GET /api/admin/transactions?limit=50` – latest transactions
- `GET /api/admin/game-results?limit=50` – latest game outcomes

Front‑end auto‑refreshes every 30s.

⚠ SECURITY: These endpoints are intentionally left public per request. For any real environment you MUST secure or remove them:
- Add API key header check (e.g. `X-ADMIN-KEY`) with secret stored in `.env`
- Or require admin JWT role via middleware
- Or disable by removing `app.use('/api/admin', adminRoutes);` and the `admin/` folder

To secure quickly with an API key:
1. Set `ADMIN_API_KEY="some-long-random-string"` in `.env`
2. Wrap admin routes with middleware verifying `req.headers['x-admin-key'] === process.env.ADMIN_API_KEY`
3. Rebuild / restart server.

Never leave sensitive operational data publicly exposed in production.

### Admin Login

A protected admin login endpoint has been added:
- `POST /api/admin/login` (expects JSON `{ username, password }` matching ENV vars)

Environment variables required:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
ADMIN_JWT_SECRET=long-random-secret
```

Login issues a JWT valid for 2h used by dashboard requests (`Authorization: Bearer <token>`).

Login Page URL: `https://moneyplant.live/adminlogin` (served by `adminlogin/index.html`).
After login, open `https://moneyplant.live/admin/` — dashboard JS must be modified to include auth header if you secure the routes. (Currently the dashboard endpoints require the admin token.)

Token storage: The demo login stores token in `localStorage.ADMIN_TOKEN`; adapt to more secure storage if needed.

To revoke access: rotate `ADMIN_JWT_SECRET` and/or change credentials and restart server.
## 📄 License

Open source for personal & educational use. Not for real-money gambling without proper legal compliance.

---

**Enjoy your gaming experience at Lucky Casino! 🎰🎲🃏**

