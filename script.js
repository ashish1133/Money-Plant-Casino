// Global state
let balance = 10000;
let currentBet = null;
let currentGame = null;

// Game states
let slotsState = {
    spinning: false,
    symbols: ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '💎', '7️⃣']
};

let rouletteState = {
    spinning: false,
    selectedBet: null,
    colors: ['red', 'black', 'green']
};

let blackjackState = {
    deck: [],
    playerHand: [],
    dealerHand: [],
    playerScore: 0,
    dealerScore: 0,
    gameStarted: false,
    gameOver: false
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateBalance();
    initializeBlackjack();
    setupEventListeners();
});

function setupEventListeners() {
    // Smooth scrolling for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Update active nav link on scroll
    window.addEventListener('scroll', updateActiveNav);
}

function updateActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

function updateBalance() {
    document.getElementById('balance').textContent = `$${balance.toLocaleString()}`;
}

function scrollToGames() {
    document.getElementById('games').scrollIntoView({ behavior: 'smooth' });
}

// Modal functions
function openGame(gameName) {
    currentGame = gameName;
    const modal = document.getElementById(`${gameName}Modal`);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Reset game state when opening
        if (gameName === 'blackjack') {
            resetBlackjack();
        }
    }
}

function closeGame(gameName) {
    const modal = document.getElementById(`${gameName}Modal`);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentGame = null;
        
        // Clear win messages
        const winMessages = modal.querySelectorAll('.win-message');
        winMessages.forEach(msg => {
            msg.textContent = '';
            msg.className = 'win-message';
        });
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentGame = null;
    }
}

// Slot Machine Game
function spinSlots() {
    if (slotsState.spinning) return;
    
    const betInput = document.getElementById('slotBet');
    const bet = parseInt(betInput.value);
    const winMessage = document.getElementById('slotWinMessage');
    
    if (bet > balance) {
        winMessage.textContent = 'Insufficient balance!';
        winMessage.className = 'win-message lose';
        return;
    }
    
    if (bet < 10) {
        winMessage.textContent = 'Minimum bet is $10!';
        winMessage.className = 'win-message lose';
        return;
    }
    
    slotsState.spinning = true;
    balance -= bet;
    updateBalance();
    
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = true;
    winMessage.textContent = '';
    winMessage.className = 'win-message';
    
    // Add spinning animation
    const reels = ['reel1', 'reel2', 'reel3'];
    reels.forEach(reelId => {
        const reel = document.getElementById(reelId);
        reel.classList.add('spinning');
    });
    
    // Spin animation
    let spinCount = 0;
    const spinInterval = setInterval(() => {
        reels.forEach(reelId => {
            const reel = document.getElementById(reelId);
            reel.textContent = slotsState.symbols[Math.floor(Math.random() * slotsState.symbols.length)];
        });
        spinCount++;
        
        if (spinCount > 20) {
            clearInterval(spinInterval);
            
            // Final spin
            const results = [];
            reels.forEach(reelId => {
                const symbol = slotsState.symbols[Math.floor(Math.random() * slotsState.symbols.length)];
                document.getElementById(reelId).textContent = symbol;
                results.push(symbol);
                document.getElementById(reelId).classList.remove('spinning');
            });
            
            // Check for wins
            checkSlotWin(results, bet, winMessage);
            slotsState.spinning = false;
            spinBtn.disabled = false;
        }
    }, 100);
}

function checkSlotWin(results, bet, winMessage) {
    // Three of a kind
    if (results[0] === results[1] && results[1] === results[2]) {
        let multiplier = 5;
        
        // Special symbols have higher multipliers
        if (results[0] === '💎') multiplier = 20;
        else if (results[0] === '⭐') multiplier = 15;
        else if (results[0] === '7️⃣') multiplier = 10;
        
        const win = bet * multiplier;
        balance += win;
        updateBalance();
        winMessage.textContent = `🎉 JACKPOT! You won $${win.toLocaleString()}!`;
        winMessage.className = 'win-message win';
        
        // Confetti effect
        createConfetti();
    }
    // Two of a kind
    else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
        const win = bet * 2;
        balance += win;
        updateBalance();
        winMessage.textContent = `Nice! You won $${win.toLocaleString()}!`;
        winMessage.className = 'win-message win';
    }
    else {
        winMessage.textContent = 'Better luck next time!';
        winMessage.className = 'win-message lose';
    }
}

// Roulette Game
function placeBet(color) {
    if (rouletteState.spinning) return;
    
    rouletteState.selectedBet = color;
    
    // Update button states
    document.querySelectorAll('.bet-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

function spinRoulette() {
    if (rouletteState.spinning) return;
    if (!rouletteState.selectedBet) {
        document.getElementById('rouletteWinMessage').textContent = 'Please select a bet!';
        return;
    }
    
    const betInput = document.getElementById('rouletteBet');
    const bet = parseInt(betInput.value);
    const winMessage = document.getElementById('rouletteWinMessage');
    
    if (bet > balance) {
        winMessage.textContent = 'Insufficient balance!';
        winMessage.className = 'win-message lose';
        return;
    }
    
    if (bet < 10) {
        winMessage.textContent = 'Minimum bet is $10!';
        winMessage.className = 'win-message lose';
        return;
    }
    
    rouletteState.spinning = true;
    balance -= bet;
    updateBalance();
    
    const wheel = document.getElementById('rouletteWheel');
    wheel.classList.add('spinning');
    
    winMessage.textContent = '';
    winMessage.className = 'win-message';
    
    // Random result (70% red, 20% black, 10% green)
    const random = Math.random();
    let result;
    if (random < 0.7) result = 'red';
    else if (random < 0.9) result = 'black';
    else result = 'green';
    
    setTimeout(() => {
        wheel.classList.remove('spinning');
        
        if (result === rouletteState.selectedBet) {
            let multiplier = 2;
            if (result === 'green') multiplier = 10;
            
            const win = bet * multiplier;
            balance += win;
            updateBalance();
            winMessage.textContent = `🎉 Winner! You won $${win.toLocaleString()}!`;
            winMessage.className = 'win-message win';
            
            if (result === 'green') {
                createConfetti();
            }
        } else {
            winMessage.textContent = `Result: ${result.toUpperCase()}. Better luck next time!`;
            winMessage.className = 'win-message lose';
        }
        
        rouletteState.spinning = false;
        rouletteState.selectedBet = null;
        document.querySelectorAll('.bet-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }, 3000);
}

// Blackjack Game
function initializeBlackjack() {
    // Create deck
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    blackjackState.deck = [];
    suits.forEach(suit => {
        ranks.forEach(rank => {
            blackjackState.deck.push({ suit, rank });
        });
    });
}

function shuffleDeck() {
    for (let i = blackjackState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [blackjackState.deck[i], blackjackState.deck[j]] = [blackjackState.deck[j], blackjackState.deck[i]];
    }
}

function resetBlackjack() {
    blackjackState.playerHand = [];
    blackjackState.dealerHand = [];
    blackjackState.playerScore = 0;
    blackjackState.dealerScore = 0;
    blackjackState.gameStarted = false;
    blackjackState.gameOver = false;
    
    document.getElementById('playerCards').innerHTML = '';
    document.getElementById('dealerCards').innerHTML = '';
    document.getElementById('playerScore').textContent = '';
    document.getElementById('dealerScore').textContent = '';
    document.getElementById('blackjackWinMessage').textContent = '';
    document.getElementById('blackjackWinMessage').className = 'win-message';
    
    document.getElementById('dealBtn').disabled = false;
    document.getElementById('hitBtn').disabled = true;
    document.getElementById('standBtn').disabled = true;
}

function dealCards() {
    const betInput = document.getElementById('blackjackBet');
    const bet = parseInt(betInput.value);
    const winMessage = document.getElementById('blackjackWinMessage');
    
    if (bet > balance) {
        winMessage.textContent = 'Insufficient balance!';
        winMessage.className = 'win-message lose';
        return;
    }
    
    if (bet < 10) {
        winMessage.textContent = 'Minimum bet is $10!';
        winMessage.className = 'win-message lose';
        return;
    }
    
    currentBet = bet;
    balance -= bet;
    updateBalance();
    
    shuffleDeck();
    blackjackState.playerHand = [];
    blackjackState.dealerHand = [];
    blackjackState.gameStarted = true;
    blackjackState.gameOver = false;
    
    // Deal initial cards
    setTimeout(() => {
        blackjackState.playerHand.push(blackjackState.deck.pop());
        displayCard('player', blackjackState.playerHand[blackjackState.playerHand.length - 1]);
    }, 100);
    
    setTimeout(() => {
        blackjackState.dealerHand.push(blackjackState.deck.pop());
        displayCard('dealer', blackjackState.dealerHand[blackjackState.dealerHand.length - 1], true);
    }, 300);
    
    setTimeout(() => {
        blackjackState.playerHand.push(blackjackState.deck.pop());
        displayCard('player', blackjackState.playerHand[blackjackState.playerHand.length - 1]);
    }, 500);
    
    setTimeout(() => {
        blackjackState.dealerHand.push(blackjackState.deck.pop());
        displayCard('dealer', blackjackState.dealerHand[blackjackState.dealerHand.length - 1], true);
    }, 700);
    
    setTimeout(() => {
        updateScores();
        document.getElementById('dealBtn').disabled = true;
        document.getElementById('hitBtn').disabled = false;
        document.getElementById('standBtn').disabled = false;
    }, 900);
}

function displayCard(player, card, hidden = false) {
    const cardContainer = document.getElementById(`${player}Cards`);
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    
    if (hidden) {
        cardElement.textContent = '🂠';
        cardElement.style.background = '#333';
    } else {
        const isRed = card.suit === '♥' || card.suit === '♦';
        cardElement.className += isRed ? ' red' : ' black';
        cardElement.textContent = `${card.rank}${card.suit}`;
    }
    
    cardContainer.appendChild(cardElement);
}

function getCardValue(card) {
    if (card.rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    return parseInt(card.rank);
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;
    
    hand.forEach(card => {
        if (card.rank === 'A') {
            aces++;
            score += 11;
        } else {
            score += getCardValue(card);
        }
    });
    
    // Adjust for aces
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    
    return score;
}

function updateScores() {
    blackjackState.playerScore = calculateScore(blackjackState.playerHand);
    blackjackState.dealerScore = calculateScore(blackjackState.dealerHand);
    
    document.getElementById('playerScore').textContent = `Score: ${blackjackState.playerScore}`;
    
    // Show dealer score only if game is over
    if (blackjackState.gameOver) {
        document.getElementById('dealerScore').textContent = `Score: ${blackjackState.dealerScore}`;
        // Reveal hidden cards
        const dealerCards = document.getElementById('dealerCards').children;
        if (dealerCards.length > 0 && dealerCards[0].textContent === '🂠') {
            dealerCards[0].textContent = `${blackjackState.dealerHand[0].rank}${blackjackState.dealerHand[0].suit}`;
            const isRed = blackjackState.dealerHand[0].suit === '♥' || blackjackState.dealerHand[0].suit === '♦';
            dealerCards[0].className = 'card ' + (isRed ? 'red' : 'black');
        }
    }
}

function hit() {
    if (!blackjackState.gameStarted || blackjackState.gameOver) return;
    
    blackjackState.playerHand.push(blackjackState.deck.pop());
    displayCard('player', blackjackState.playerHand[blackjackState.playerHand.length - 1]);
    
    setTimeout(() => {
        updateScores();
        
        if (blackjackState.playerScore > 21) {
            endGame('Bust! You lose.');
        } else if (blackjackState.playerScore === 21) {
            endGame('Blackjack! You win!');
        }
    }, 300);
}

function stand() {
    if (!blackjackState.gameStarted || blackjackState.gameOver) return;
    
    blackjackState.gameOver = true;
    updateScores();
    
    // Dealer draws until 17 or higher
    setTimeout(() => {
        while (blackjackState.dealerScore < 17) {
            blackjackState.dealerHand.push(blackjackState.deck.pop());
            displayCard('dealer', blackjackState.dealerHand[blackjackState.dealerHand.length - 1]);
            blackjackState.dealerScore = calculateScore(blackjackState.dealerHand);
        }
        
        updateScores();
        checkWinner();
    }, 500);
}

function checkWinner() {
    const winMessage = document.getElementById('blackjackWinMessage');
    
    if (blackjackState.dealerScore > 21) {
        const win = currentBet * 2;
        balance += win;
        updateBalance();
        winMessage.textContent = `Dealer busts! You win $${win.toLocaleString()}!`;
        winMessage.className = 'win-message win';
        createConfetti();
    } else if (blackjackState.playerScore > blackjackState.dealerScore) {
        const win = currentBet * 2;
        balance += win;
        updateBalance();
        winMessage.textContent = `You win $${win.toLocaleString()}!`;
        winMessage.className = 'win-message win';
        createConfetti();
    } else if (blackjackState.playerScore < blackjackState.dealerScore) {
        winMessage.textContent = 'Dealer wins!';
        winMessage.className = 'win-message lose';
    } else {
        balance += currentBet;
        updateBalance();
        winMessage.textContent = 'Push! Bet returned.';
        winMessage.className = 'win-message';
    }
    
    document.getElementById('hitBtn').disabled = true;
    document.getElementById('standBtn').disabled = true;
    document.getElementById('dealBtn').disabled = false;
}

function endGame(message) {
    blackjackState.gameOver = true;
    const winMessage = document.getElementById('blackjackWinMessage');
    
    if (message.includes('win') || message.includes('Blackjack')) {
        const win = currentBet * 2;
        balance += win;
        updateBalance();
        winMessage.textContent = `${message} You win $${win.toLocaleString()}!`;
        winMessage.className = 'win-message win';
        createConfetti();
    } else {
        winMessage.textContent = message;
        winMessage.className = 'win-message lose';
    }
    
    document.getElementById('hitBtn').disabled = true;
    document.getElementById('standBtn').disabled = true;
    document.getElementById('dealBtn').disabled = false;
    
    // Reveal dealer cards
    updateScores();
}

// Confetti effect
function createConfetti() {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = '10px';
            confetti.style.height = '10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-10px';
            confetti.style.borderRadius = '50%';
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '9999';
            confetti.style.animation = `confettiFall ${2 + Math.random() * 2}s linear forwards`;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, 4000);
        }, i * 20);
    }
}

// Add confetti animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

