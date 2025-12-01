// Dynamic API base URL resolution:
// Priority order:
// 1. window.API_BASE_URL (set before script load)
// 2. <meta name="api-base" content="https://backend.example/api"> tag
// 3. If running on localhost -> http://localhost:3000/api
// 4. Otherwise derive from current origin (same-domain deployment) + '/api'
// This allows the same bundled frontend to work on GitHub Pages (with a deployed backend)
// or when served directly by the Express server.
let API_BASE_URL = 'http://localhost:3000/api';
let IS_FIREBASE_FUNCTIONS = false;
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
        IS_FIREBASE_FUNCTIONS = /cloudfunctions\.net/.test(API_BASE_URL);
    }
} catch (e) {
    console.warn('API base URL auto-detect failed, using default', e);
}

function makeUrl(endpoint){
    // If using Firebase Functions, endpoints are function names at root
    if (IS_FIREBASE_FUNCTIONS) {
        // Map known endpoints
        switch(endpoint){
            case '/users/profile': return API_BASE_URL.replace(/\/$/,'') + '/usersProfile';
            case '/wallet/deposit': return API_BASE_URL.replace(/\/$/,'') + '/walletDeposit';
            case '/wallet/withdraw': return API_BASE_URL.replace(/\/$/,'') + '/walletWithdraw';
            case '/games/slots': return API_BASE_URL.replace(/\/$/,'') + '/gamesSlots';
            case '/games/roulette': return API_BASE_URL.replace(/\/$/,'') + '/gamesRoulette';
            case '/games/dice': return API_BASE_URL.replace(/\/$/,'') + '/gamesDice';
            case '/games/crash': return API_BASE_URL.replace(/\/$/,'') + '/gamesCrash';
            default:
                // Fallback: strip leading '/api' and slashes -> function name
                return API_BASE_URL.replace(/\/$/,'') + '/' + endpoint.replace(/^\/?(api\/)?/,'').replace(/\//g,'_');
        }
    }
    // Express-style
    return API_BASE_URL.replace(/\/$/,'') + endpoint;
}

class APIClient {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
    }

    async request(endpoint, options = {}) {
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            }
        };

        // Attach Firebase ID token (required)
        if (typeof window !== 'undefined' && window.getFirebaseIdToken) {
            try {
                const idToken = await window.getFirebaseIdToken();
                if (idToken) {
                    config.headers['Authorization'] = `Bearer ${idToken}`;
                }
            } catch (_) {}
        }

        try {
            const response = await fetch(makeUrl(endpoint), config);

            // If unauthorized, surface error (Firebase token missing/invalid)
            if (response.status === 401) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Unauthorized — sign in with Firebase');
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
    async register(arg1, email, password) {
        // Support either (profileObject) or (username, email, password)
        if (typeof window !== 'undefined') {
            if (typeof arg1 === 'object' && arg1 !== null) {
                if (window.firebaseSignupWithProfile) {
                    await window.firebaseSignupWithProfile(arg1);
                    return { firebase: true };
                }
            } else if (window.firebaseSignup) {
                await window.firebaseSignup(email, password);
                return { firebase: true };
            }
        }
        throw new Error('Firebase signup unavailable');
    }

    async login(email, password) {
        // Firebase-only
        if (typeof window !== 'undefined' && window.firebaseLogin) {
            await window.firebaseLogin(email, password);
            return { firebase: true };
        }
        throw new Error('Firebase login unavailable');
    }

    async refreshAccessToken() {
        // Firebase handles token refresh internally; no-op
        return true;
    }

    async logout() {
        try {
            if (typeof window !== 'undefined' && window.firebaseLogout) {
                await window.firebaseLogout();
            }
        } catch (error) {
            console.error('Firebase logout failed:', error);
        }
    }

    setTokens(accessToken, refreshToken) {
        // Deprecated for Firebase-only auth
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
    }

    isAuthenticated() {
        // Consider authenticated if Firebase has a current user
        try {
            return !!(window.firebaseAuth && window.firebaseAuth.currentUser);
        } catch (_) {
            return false;
        }
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

    async playCrash(betAmount, autoCashout) {
        return await this.request('/games/crash', {
            method: 'POST',
            body: JSON.stringify({ betAmount, autoCashout })
        });
    }

    async playDice(betAmount, target) {
        return await this.request('/games/dice', {
            method: 'POST',
            body: JSON.stringify({ betAmount, target })
        });
    }

    async playPlinko(betAmount, rows = 8) {
        return await this.request('/games/plinko', {
            method: 'POST',
            body: JSON.stringify({ betAmount, rows })
        });
    }

    async getGamesCatalog() {
        return await this.request('/games/catalog');
    }

    async playLimbo(betAmount, target) {
        return await this.request('/games/limbo', {
            method: 'POST',
            body: JSON.stringify({ betAmount, target })
        });
    }

    async playMines(betAmount, bombs, picks) {
        return await this.request('/games/mines', {
            method: 'POST',
            body: JSON.stringify({ betAmount, bombs, picks })
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
