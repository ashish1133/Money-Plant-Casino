// Dynamic API base URL resolution:
// Priority order:
// 1. window.API_BASE_URL (set before script load)
// 2. <meta name="api-base" content="https://backend.example/api"> tag
// 3. If running on localhost -> http://localhost:3000/api
// 4. Otherwise derive from current origin (same-domain deployment) + '/api'
// This allows the same bundled frontend to work on GitHub Pages (with a deployed backend)
// or when served directly by the Express server.
let API_BASE_URL = 'http://localhost:3000/api';
try {
    if (typeof window !== 'undefined') {
        if (window.API_BASE_URL) {
            API_BASE_URL = window.API_BASE_URL;
        } else {
            const meta = document.querySelector('meta[name="api-base"]');
            if (meta && meta.content) {
                API_BASE_URL = meta.content.trim();
            } else if (window.location.hostname !== 'localhost') {
                // Assume same-domain deployment for production unless overridden
                API_BASE_URL = window.location.origin.replace(/\/$/, '') + '/api';
            }
        }
    }
} catch (e) {
    console.warn('API base URL auto-detect failed, using default', e);
}

class APIClient {
    constructor() {
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
    }

    async request(endpoint, options = {}) {
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            }
        };

        if (this.accessToken) {
            config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

            // Handle 401 - try to refresh token
            if (response.status === 401 && this.refreshToken) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    // Retry original request with new token
                    config.headers['Authorization'] = `Bearer ${this.accessToken}`;
                    return await fetch(`${API_BASE_URL}${endpoint}`, config);
                } else {
                    this.logout();
                    throw new Error('Session expired. Please login again.');
                }
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Auth
    async register(username, email, password) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        this.setTokens(data.accessToken, data.refreshToken);
        return data;
    }

    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        this.setTokens(data.accessToken, data.refreshToken);
        return data;
    }

    async refreshAccessToken() {
        try {
            const data = await this.request('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });
            this.setTokens(data.accessToken, data.refreshToken);
            return true;
        } catch (error) {
            return false;
        }
    }

    async logout() {
        try {
            await this.request('/auth/logout', {
                method: 'POST',
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            this.clearTokens();
        }
    }

    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    }

    isAuthenticated() {
        return !!this.accessToken;
    }

    // Wallet
    async getBalance() {
        return await this.request('/wallet/balance');
    }

    async deposit(amount) {
        return await this.request('/wallet/deposit', {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
    }

    async withdraw(amount) {
        return await this.request('/wallet/withdraw', {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
    }

    async getTransactions(limit = 10, offset = 0) {
        return await this.request(`/wallet/transactions?limit=${limit}&offset=${offset}`);
    }

    // Games
    async playSlots(betAmount) {
        return await this.request('/games/slots', {
            method: 'POST',
            body: JSON.stringify({ betAmount })
        });
    }

    async playRoulette(betAmount, betColor) {
        return await this.request('/games/roulette', {
            method: 'POST',
            body: JSON.stringify({ betAmount, betColor })
        });
    }

    async dealBlackjack(betAmount) {
        return await this.request('/games/blackjack', {
            method: 'POST',
            body: JSON.stringify({ betAmount, action: 'deal' })
        });
    }

    async hitBlackjack(gameState) {
        const betAmount = gameState?.betAmount;
        return await this.request('/games/blackjack', {
            method: 'POST',
            body: JSON.stringify({ action: 'hit', gameState, betAmount })
        });
    }

    async standBlackjack(gameState) {
        const betAmount = gameState?.betAmount;
        return await this.request('/games/blackjack', {
            method: 'POST',
            body: JSON.stringify({ action: 'stand', gameState, betAmount })
        });
    }

    async verifyGame(seed, hash) {
        return await this.request('/games/verify', {
            method: 'POST',
            body: JSON.stringify({ seed, hash })
        });
    }

    // User
    async getProfile() {
        return await this.request('/users/profile');
    }

    async getStats() {
        return await this.request('/users/stats');
    }

    async getAchievements() {
        return await this.request('/users/achievements');
    }

    async claimDailyBonus() {
        return await this.request('/users/daily-bonus', {
            method: 'POST'
        });
    }

    async getLeaderboard(type = 'profit', game = null, limit = 10) {
        let url = `/users/leaderboard?type=${type}&limit=${limit}`;
        if (game) url += `&game=${game}`;
        return await this.request(url);
    }
}

// Export singleton instance
const apiClient = new APIClient();
