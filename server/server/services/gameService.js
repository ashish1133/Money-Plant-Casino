const { db } = require('../config/database');
const FairRNG = require('../utils/fairRNG');
const WalletService = require('./walletService');
const logger = require('../config/logger');

class GameService {
    static playSlots(userId, betAmount) {
        return db.transaction(() => {
            // Validate bet
            const balance = WalletService.getBalance(userId);
            if (betAmount > balance || betAmount < 10) {
                throw new Error('Invalid bet amount');
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
            if (betAmount > balance || betAmount < 10) {
                throw new Error('Invalid bet amount');
            }

            if (!['red', 'black', 'green'].includes(betColor)) {
                throw new Error('Invalid bet color');
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
                if (betAmount > balance || betAmount < 10) {
                    throw new Error('Invalid bet amount');
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

                return {
                    gameState,
                    winAmount,
                    profit,
                    outcome,
                    balance: WalletService.getBalance(userId)
                };
            }
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
}

module.exports = GameService;
