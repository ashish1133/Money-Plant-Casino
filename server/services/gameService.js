const { db } = require('../config/database');
const FairRNG = require('../utils/fairRNG');
const WalletService = require('./walletService');
const logger = require('../config/logger');
const FirestoreService = require('./firestoreService');

class GameService {
    static playSlots(userId, betAmount) {
        return db.transaction(() => {
            // Validate bet
            const balance = WalletService.getBalance(userId);
            const minBet = parseFloat(process.env.MIN_BET || '10');
            const maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0');
            if (betAmount > balance || betAmount < minBet) {
                throw new Error('Invalid bet amount');
            }

            if (maxDailyLoss > 0) {
                const dailyLoss = WalletService.getDailyLoss(userId);
                if (dailyLoss + betAmount > maxDailyLoss) {
                    throw new Error('Daily loss limit reached');
                }
            }

            // Deduct bet
            WalletService.updateBalance(userId, -betAmount, 'bet', { game: 'slots' });

            // Generate fair result
            const { seed, hash } = FairRNG.generate();
            const symbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '💎', '7️⃣'];
            
            const reel1 = FairRNG.pickRandom(seed + '1', symbols);
            const reel2 = FairRNG.pickRandom(seed + '2', symbols);
            const reel3 = FairRNG.pickRandom(seed + '3', symbols);

            // Calculate win
            let winAmount = 0;
            let outcome = 'loss';
            
            if (reel1 === reel2 && reel2 === reel3) {
                // Three of a kind
                let multiplier = 5;
                if (reel1 === '💎') multiplier = 20;
                else if (reel1 === '⭐') multiplier = 15;
                else if (reel1 === '7️⃣') multiplier = 10;
                
                winAmount = betAmount * multiplier;
                outcome = 'jackpot';
            } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
                // Two of a kind
                winAmount = betAmount * 2;
                outcome = 'win';
            }

            // Add winnings
            if (winAmount > 0) {
                WalletService.updateBalance(userId, winAmount, 'win', { game: 'slots', outcome });
            }

            const profit = winAmount - betAmount;

            // Record game result
            db.prepare(`
                INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, 'slots', betAmount, winAmount, profit, outcome, seed, hash, JSON.stringify({ reel1, reel2, reel3 }));

            logger.info(`Slots game: User ${userId}, Bet: ${betAmount}, Win: ${winAmount}, Result: ${outcome}`);

            // Firestore mirror
            try {
                FirestoreService.recordGamePlay({ userId, gameName: 'slots', betAmount, winAmount, profit, outcome, details: { reel1, reel2, reel3 } });
            } catch(_) {}

            return {
                reels: [reel1, reel2, reel3],
                winAmount,
                profit,
                outcome,
                balance: WalletService.getBalance(userId),
                seed,
                hash
            };
        })();
    }

    static playRoulette(userId, betAmount, betColor) {
        return db.transaction(() => {
            const balance = WalletService.getBalance(userId);
            const minBet = parseFloat(process.env.MIN_BET || '10');
            const maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0');
            if (betAmount > balance || betAmount < minBet) {
                throw new Error('Invalid bet amount');
            }

            if (!['red', 'black', 'green'].includes(betColor)) {
                throw new Error('Invalid bet color');
            }

            if (maxDailyLoss > 0) {
                const dailyLoss = WalletService.getDailyLoss(userId);
                if (dailyLoss + betAmount > maxDailyLoss) {
                    throw new Error('Daily loss limit reached');
                }
            }

            WalletService.updateBalance(userId, -betAmount, 'bet', { game: 'roulette', betColor });

            const { seed, hash } = FairRNG.generate();
            const result = FairRNG.weightedRandom(seed, { red: 70, black: 20, green: 10 });

            let winAmount = 0;
            let outcome = 'loss';

            if (result === betColor) {
                const multiplier = result === 'green' ? 10 : 2;
                winAmount = betAmount * multiplier;
                outcome = 'win';
                WalletService.updateBalance(userId, winAmount, 'win', { game: 'roulette', result });
            }

            const profit = winAmount - betAmount;

            db.prepare(`
                INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, 'roulette', betAmount, winAmount, profit, outcome, seed, hash, JSON.stringify({ result, betColor }));

            logger.info(`Roulette game: User ${userId}, Bet: ${betAmount} on ${betColor}, Result: ${result}, Win: ${winAmount}`);
            try {
                FirestoreService.recordGamePlay({ userId, gameName: 'roulette', betAmount, winAmount, profit, outcome, details: { result, betColor } });
            } catch(_) {}

            return {
                result,
                winAmount,
                profit,
                outcome,
                balance: WalletService.getBalance(userId),
                seed,
                hash
            };
        })();
    }

    static playBlackjack(userId, betAmount, action, gameState = null) {
        return db.transaction(() => {
            const balance = WalletService.getBalance(userId);
            
            if (action === 'deal') {
                const minBet = parseFloat(process.env.MIN_BET || '10');
                const maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0');
                if (betAmount > balance || betAmount < minBet) {
                    throw new Error('Invalid bet amount');
                }

                if (maxDailyLoss > 0) {
                    const dailyLoss = WalletService.getDailyLoss(userId);
                    if (dailyLoss + betAmount > maxDailyLoss) {
                        throw new Error('Daily loss limit reached');
                    }
                }

                WalletService.updateBalance(userId, -betAmount, 'bet', { game: 'blackjack' });

                const { seed, hash } = FairRNG.generate();
                const deck = this._generateDeck();
                
                // Deal cards
                const playerHand = [
                    deck[FairRNG.randomInRange(seed + '0', 0, deck.length)],
                    deck[FairRNG.randomInRange(seed + '1', 0, deck.length)]
                ];
                const dealerHand = [
                    deck[FairRNG.randomInRange(seed + '2', 0, deck.length)],
                    deck[FairRNG.randomInRange(seed + '3', 0, deck.length)]
                ];

                const playerScore = this._calculateScore(playerHand);
                const dealerScore = this._calculateScore([dealerHand[0]]); // Show only one dealer card

                return {
                    gameState: {
                        playerHand,
                        dealerHand,
                        playerScore,
                        dealerScore,
                        seed,
                        hash,
                        betAmount
                    },
                    balance: WalletService.getBalance(userId)
                };
            } else if (action === 'hit') {
                // Player draws card
                const deck = this._generateDeck();
                const newCard = deck[FairRNG.randomInRange(gameState.seed + gameState.playerHand.length, 0, deck.length)];
                gameState.playerHand.push(newCard);
                gameState.playerScore = this._calculateScore(gameState.playerHand);

                if (gameState.playerScore > 21) {
                    // Bust - record loss
                    db.prepare(`
                        INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(userId, 'blackjack', betAmount, 0, -betAmount, 'bust', gameState.seed, gameState.hash, JSON.stringify(gameState));

                    return { gameState, outcome: 'bust', balance: WalletService.getBalance(userId) };
                }

                return { gameState, balance: WalletService.getBalance(userId) };
            } else if (action === 'stand') {
                // Dealer plays
                let dealerScore = this._calculateScore(gameState.dealerHand);
                const deck = this._generateDeck();
                let cardIndex = 4;

                while (dealerScore < 17) {
                    const newCard = deck[FairRNG.randomInRange(gameState.seed + cardIndex, 0, deck.length)];
                    gameState.dealerHand.push(newCard);
                    dealerScore = this._calculateScore(gameState.dealerHand);
                    cardIndex++;
                }

                gameState.dealerScore = dealerScore;
                const playerScore = gameState.playerScore;

                let winAmount = 0;
                let outcome = 'loss';

                if (dealerScore > 21 || playerScore > dealerScore) {
                    winAmount = betAmount * 2;
                    outcome = 'win';
                    WalletService.updateBalance(userId, winAmount, 'win', { game: 'blackjack' });
                } else if (playerScore === dealerScore) {
                    winAmount = betAmount;
                    outcome = 'push';
                    WalletService.updateBalance(userId, winAmount, 'win', { game: 'blackjack', push: true });
                }

                const profit = winAmount - betAmount;

                db.prepare(`
                    INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(userId, 'blackjack', betAmount, winAmount, profit, outcome, gameState.seed, gameState.hash, JSON.stringify(gameState));

                const resp = {
                    gameState,
                    winAmount,
                    profit,
                    outcome,
                    balance: WalletService.getBalance(userId)
                };
                try {
                    FirestoreService.recordGamePlay({ userId, gameName: 'blackjack', betAmount, winAmount, profit, outcome, details: gameState });
                } catch(_) {}
                return resp;
            }
        })();
    }

    static playCrash(userId, betAmount, autoCashout) {
        return db.transaction(() => {
            const balance = WalletService.getBalance(userId);
            const minBet = parseFloat(process.env.MIN_BET || '10');
            const maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0');
            const maxCashout = parseFloat(process.env.CRASH_MAX_CASHOUT || '100');
            const houseEdge = Math.min(Math.max(parseFloat(process.env.CRASH_HOUSE_EDGE || '0.01'), 0), 0.2);

            if (betAmount > balance || betAmount < minBet) {
                throw new Error('Invalid bet amount');
            }
            if (!autoCashout || autoCashout < 1.01 || autoCashout > maxCashout) {
                throw new Error('Invalid auto-cashout');
            }
            if (maxDailyLoss > 0) {
                const dailyLoss = WalletService.getDailyLoss(userId);
                if (dailyLoss + betAmount > maxDailyLoss) {
                    throw new Error('Daily loss limit reached');
                }
            }

            // Place bet
            WalletService.updateBalance(userId, -betAmount, 'bet', { game: 'crash', autoCashout });

            // Fair result
            const { seed, hash } = FairRNG.generate();
            const bust = FairRNG.crashMultiplier(seed, houseEdge, maxCashout);

            let winAmount = 0;
            let outcome = 'loss';
            if (autoCashout <= bust) {
                winAmount = Math.round((betAmount * autoCashout) * 100) / 100;
                outcome = 'win';
                WalletService.updateBalance(userId, winAmount, 'win', { game: 'crash', autoCashout, bust });
            }

            const profit = winAmount - betAmount;
            db.prepare(`
                INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, 'crash', betAmount, winAmount, profit, outcome, seed, hash, JSON.stringify({ autoCashout, bust, houseEdge }));

            logger.info(`Crash: user ${userId}, bet ${betAmount}, auto ${autoCashout}, bust ${bust}, win ${winAmount}`);
            try {
                FirestoreService.recordGamePlay({ userId, gameName: 'crash', betAmount, winAmount, profit, outcome: (winAmount>0?'win':'loss'), details: { autoCashout, bust, houseEdge } });
            } catch(_) {}

            return {
                bust,
                cashedOut: winAmount > 0,
                winAmount,
                profit,
                balance: WalletService.getBalance(userId),
                seed,
                hash
            };
        })();
    }

    static playDice(userId, betAmount, target) {
        return db.transaction(() => {
            const balance = WalletService.getBalance(userId);
            const minBet = parseFloat(process.env.MIN_BET || '10');
            const maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0');
            const houseEdge = Math.min(Math.max(parseFloat(process.env.DICE_HOUSE_EDGE || '0.01'), 0), 0.2);

            if (betAmount > balance || betAmount < minBet) throw new Error('Invalid bet amount');
            if (!Number.isFinite(target) || target < 2 || target > 98) throw new Error('Target must be 2-98');
            if (maxDailyLoss > 0) {
                const dailyLoss = WalletService.getDailyLoss(userId);
                if (dailyLoss + betAmount > maxDailyLoss) throw new Error('Daily loss limit reached');
            }

            WalletService.updateBalance(userId, -betAmount, 'bet', { game: 'dice', target });

            const { seed, hash } = FairRNG.generate();
            // Roll 1..100 uniformly
            const roll = FairRNG.randomInRange(seed, 1, 101);
            const win = roll < target; // roll-under

            // Payout: (1 - edge) * bet * 100 / (target - 1)
            let winAmount = 0;
            let outcome = 'loss';
            if (win) {
                const multiplier = (1 - houseEdge) * (100 / (target - 1));
                winAmount = Math.round(betAmount * multiplier * 100) / 100;
                outcome = 'win';
                WalletService.updateBalance(userId, winAmount, 'win', { game: 'dice', target, roll });
            }

            const profit = winAmount - betAmount;
            db.prepare(`
                INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, 'dice', betAmount, winAmount, profit, outcome, seed, hash, JSON.stringify({ target, roll, houseEdge }));

            logger.info(`Dice: user ${userId}, bet ${betAmount}, target ${target}, roll ${roll}, win ${winAmount}`);
            try { FirestoreService.recordGamePlay({ userId, gameName: 'dice', betAmount, winAmount, profit, outcome, details: { target, roll, houseEdge } }); } catch(_) {}
            return {
                roll,
                target,
                winAmount,
                profit,
                outcome,
                balance: WalletService.getBalance(userId),
                seed,
                hash
            };
        })();
    }

    static playPlinko(userId, betAmount, rows = 8) {
        return db.transaction(() => {
            const balance = WalletService.getBalance(userId);
            const minBet = parseFloat(process.env.MIN_BET || '10');
            const maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0');
            const houseEdge = Math.min(Math.max(parseFloat(process.env.PLINKO_HOUSE_EDGE || '0.02'), 0), 0.2);

            rows = Math.max(6, Math.min(16, parseInt(rows, 10) || 8));
            if (betAmount > balance || betAmount < minBet) throw new Error('Invalid bet amount');
            if (maxDailyLoss > 0) {
                const dailyLoss = WalletService.getDailyLoss(userId);
                if (dailyLoss + betAmount > maxDailyLoss) throw new Error('Daily loss limit reached');
            }

            WalletService.updateBalance(userId, -betAmount, 'bet', { game: 'plinko', rows });

            const { seed, hash } = FairRNG.generate();
            // Simulate path: rows steps, left/right choices
            let rights = 0;
            const decisions = [];
            for (let i = 0; i < rows; i++) {
                const choice = FairRNG.randomInRange(seed + ':' + i, 0, 2); // 0 left, 1 right
                decisions.push(choice === 1 ? 'R' : 'L');
                if (choice === 1) rights++;
            }

            // Simple symmetric payout table adjusted by (1 - houseEdge)
            const baseMultipliers = PlinkoTables.get(rows);
            const rawMultiplier = baseMultipliers[rights] || 0;
            const multiplier = Math.max(0, Math.round(rawMultiplier * (1 - houseEdge) * 100) / 100);
            const winAmount = Math.round(betAmount * multiplier * 100) / 100;
            const outcome = winAmount > 0 ? 'win' : 'loss';

            if (winAmount > 0) {
                WalletService.updateBalance(userId, winAmount, 'win', { game: 'plinko', rows, rights });
            }

            const profit = winAmount - betAmount;
            db.prepare(`
                INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, 'plinko', betAmount, winAmount, profit, outcome, seed, hash, JSON.stringify({ rows, rights, decisions, multiplier }));

            logger.info(`Plinko: user ${userId}, bet ${betAmount}, rows ${rows}, rights ${rights}, x${multiplier}, win ${winAmount}`);
            try { FirestoreService.recordGamePlay({ userId, gameName: 'plinko', betAmount, winAmount, profit, outcome, details: { rows, rights, decisions, multiplier } }); } catch(_) {}
            return {
                rows,
                rights,
                path: decisions,
                multiplier,
                winAmount,
                profit,
                balance: WalletService.getBalance(userId),
                seed,
                hash
            };
        })();
    }

    static _generateDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push({ suit, rank });
            }
        }
        return deck;
    }

    static _calculateScore(hand) {
        let score = 0;
        let aces = 0;

        for (const card of hand) {
            if (card.rank === 'A') {
                aces++;
                score += 11;
            } else if (['J', 'Q', 'K'].includes(card.rank)) {
                score += 10;
            } else {
                score += parseInt(card.rank);
            }
        }

        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }

        return score;
    }

    static verifyGame(seed, hash) {
        return FairRNG.verify(seed, hash);
    }

    static playLimbo(userId, betAmount, target) {
        return db.transaction(() => {
            const balance = WalletService.getBalance(userId);
            const minBet = parseFloat(process.env.MIN_BET || '10');
            const maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0');
            const houseEdge = Math.min(Math.max(parseFloat(process.env.LIMBO_HOUSE_EDGE || '0.01'), 0), 0.2);
            if (betAmount > balance || betAmount < minBet) throw new Error('Invalid bet amount');
            if (!Number.isFinite(target) || target < 1.01 || target > 1000) throw new Error('Target multiplier out of range');
            if (maxDailyLoss > 0) {
                const dailyLoss = WalletService.getDailyLoss(userId);
                if (dailyLoss + betAmount > maxDailyLoss) throw new Error('Daily loss limit reached');
            }

            WalletService.updateBalance(userId, -betAmount, 'bet', { game: 'limbo', target });
            const { seed, hash } = FairRNG.generate();
            const u = FairRNG.uniform(seed);
            const winProb = Math.min(1, (1 - houseEdge) / target);
            let winAmount = 0;
            let outcome = 'loss';
            if (u < winProb) {
                const multiplier = target * (1 - houseEdge);
                winAmount = Math.round(betAmount * multiplier * 100) / 100;
                outcome = 'win';
                WalletService.updateBalance(userId, winAmount, 'win', { game: 'limbo', target });
            }
            const profit = winAmount - betAmount;
            db.prepare(`
                INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, 'limbo', betAmount, winAmount, profit, outcome, seed, hash, JSON.stringify({ target, houseEdge, winProb }));
            try { FirestoreService.recordGamePlay({ userId, gameName: 'limbo', betAmount, winAmount, profit, outcome, details: { target, houseEdge, winProb } }); } catch(_) {}
            return {
                target,
                winAmount,
                profit,
                outcome,
                balance: WalletService.getBalance(userId),
                seed,
                hash
            };
        })();
    }

    static playMines(userId, betAmount, bombs, picks) {
        return db.transaction(() => {
            const balance = WalletService.getBalance(userId);
            const minBet = parseFloat(process.env.MIN_BET || '10');
            const maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0');
            const houseEdge = Math.min(Math.max(parseFloat(process.env.MINES_HOUSE_EDGE || '0.02'), 0), 0.2);
            const grid = 25; // 5x5
            bombs = parseInt(bombs, 10);
            picks = parseInt(picks, 10);
            if (betAmount > balance || betAmount < minBet) throw new Error('Invalid bet amount');
            if (!Number.isFinite(bombs) || bombs < 1 || bombs >= grid) throw new Error('Invalid bombs');
            if (!Number.isFinite(picks) || picks < 1 || picks > (grid - bombs)) throw new Error('Invalid picks');
            if (maxDailyLoss > 0) {
                const dailyLoss = WalletService.getDailyLoss(userId);
                if (dailyLoss + betAmount > maxDailyLoss) throw new Error('Daily loss limit reached');
            }

            WalletService.updateBalance(userId, -betAmount, 'bet', { game: 'mines', bombs, picks });

            const { seed, hash } = FairRNG.generate();
            // Probability all picks are safe: C(grid-bombs, picks) / C(grid, picks)
            const comb = (n, k) => {
                if (k < 0 || k > n) return 0;
                if (k === 0 || k === n) return 1;
                k = Math.min(k, n - k);
                let num = 1, den = 1;
                for (let i = 1; i <= k; i++) { num *= (n - (k - i)); den *= i; }
                return num / den;
            };
            const safe = grid - bombs;
            const pSafe = comb(safe, picks) / comb(grid, picks);
            const multiplier = Math.max(0, Math.round(((1 - houseEdge) / pSafe) * 100) / 100);

            const u = FairRNG.uniform(seed);
            let winAmount = 0;
            let outcome = 'loss';
            if (u < pSafe) {
                winAmount = Math.round(betAmount * multiplier * 100) / 100;
                outcome = 'win';
                WalletService.updateBalance(userId, winAmount, 'win', { game: 'mines', bombs, picks });
            }
            const profit = winAmount - betAmount;
            db.prepare(`
                INSERT INTO game_results (user_id, game, bet_amount, win_amount, profit, outcome, seed, hash, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, 'mines', betAmount, winAmount, profit, outcome, seed, hash, JSON.stringify({ bombs, picks, grid, pSafe, multiplier }));
            try { FirestoreService.recordGamePlay({ userId, gameName: 'mines', betAmount, winAmount, profit, outcome, details: { bombs, picks, grid, pSafe, multiplier } }); } catch(_) {}
            return {
                bombs,
                picks,
                probability: pSafe,
                multiplier,
                winAmount,
                profit,
                balance: WalletService.getBalance(userId),
                seed,
                hash
            };
        })();
    }
}

module.exports = GameService;

// Minimal plinko payout tables (illustrative, not certified RTP)
const PlinkoTables = {
    get(rows) {
        // For simplicity, define for common row counts; default to 8 rows
        const tables = {
            6: [0.5, 1, 1.5, 3, 1.5, 1, 0.5],
            8: [0.3, 0.7, 1, 1.5, 3, 1.5, 1, 0.7, 0.3],
            10: [0.2, 0.5, 0.8, 1, 1.3, 3, 1.3, 1, 0.8, 0.5, 0.2],
            12: [0.1, 0.3, 0.6, 0.9, 1.1, 1.4, 3, 1.4, 1.1, 0.9, 0.6, 0.3, 0.1],
            14: [0.1, 0.2, 0.4, 0.7, 0.9, 1.1, 1.3, 3, 1.3, 1.1, 0.9, 0.7, 0.4, 0.2, 0.1],
            16: [0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 3, 1.3, 1.1, 0.9, 0.7, 0.5, 0.3, 0.2, 0.1]
        };
        return tables[rows] || tables[8];
    }
};
