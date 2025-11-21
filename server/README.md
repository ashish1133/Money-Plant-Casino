# Casino Backend Setup

## Prerequisites
- Node.js 18 or higher
- npm or yarn

## Installation

1. Install dependencies:
```bash
cd server
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` and set your configuration:
- `JWT_ACCESS_SECRET`: Strong random string for access tokens
- `JWT_REFRESH_SECRET`: Strong random string for refresh tokens
- `CORS_ORIGIN`: Your frontend URL (default: http://localhost:8000)

4. Initialize the database:
```bash
npm run init-db
```

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on port 3000 (or the port specified in your `.env` file).

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Wallet
- `GET /api/wallet/balance` - Get current balance
- `GET /api/wallet/transactions` - Get transaction history
- `POST /api/wallet/deposit` - Deposit funds
- `POST /api/wallet/withdraw` - Withdraw funds

### Games
- `POST /api/games/slots` - Play slots
- `POST /api/games/roulette` - Play roulette
- `POST /api/games/blackjack` - Play blackjack
- `POST /api/games/verify` - Verify game fairness

### User
- `GET /api/users/profile` - Get user profile
- `GET /api/users/stats` - Get gameplay statistics
- `GET /api/users/achievements` - Get achievements
- `POST /api/users/daily-bonus` - Claim daily bonus
- `GET /api/users/leaderboard` - Get leaderboard

### Health Check
- `GET /health` - Server health status

## Frontend Integration

1. Include the API client in your HTML:
```html
<script src="api-client.js"></script>
```

2. Use the API client in your code:
```javascript
// Login
await apiClient.login('username', 'password');

// Play slots
const result = await apiClient.playSlots(100);

// Get balance
const { balance } = await apiClient.getBalance();
```

## Database

The application uses SQLite with the following tables:
- `users` - User accounts
- `balances` - User balances
- `transactions` - Transaction ledger
- `game_results` - Game history
- `achievements` - User achievements
- `daily_streaks` - Daily bonus streaks
- `refresh_tokens` - Authentication tokens

Database file location: `server/casino.db`

## Security Features

- JWT authentication with access and refresh tokens
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- Input validation on all endpoints
- Provably fair random number generation

## Responsible Gaming

The platform includes:
- Daily loss limits (configurable in `.env`)
- Session time warnings
- Self-exclusion flags
- Transaction history tracking

## Logging

Logs are stored in:
- `server/logs/error.log` - Error logs
- `server/logs/combined.log` - All logs

## Testing

Run tests (when implemented):
```bash
npm test
```

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start server.js --name casino-api
```

3. Set up reverse proxy (nginx recommended)
4. Enable HTTPS
5. Configure firewall rules
6. Set up automated backups for `casino.db`

## Troubleshooting

### Database locked error
- Ensure only one server instance is running
- Check file permissions on `casino.db`

### CORS errors
- Update `CORS_ORIGIN` in `.env` to match your frontend URL
- Ensure credentials are included in frontend requests

### Token expired errors
- Check that refresh token flow is working
- Verify `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set
