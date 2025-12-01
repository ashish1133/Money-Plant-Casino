const crypto = require('crypto');

class FairRNG {
    /**
     * Generate a provably fair random result
     * @returns {object} { seed, hash, result }
     */
    static generate() {
        const seed = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(seed).digest('hex');
        return { seed, hash };
    }

    /**
     * Generate random number in range using seed
     * @param {string} seed - The random seed
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (exclusive)
     * @returns {number}
     */
    static randomInRange(seed, min, max) {
        const hash = crypto.createHash('sha256').update(seed).digest('hex');
        const num = parseInt(hash.substring(0, 8), 16);
        return min + (num % (max - min));
    }

    /**
     * Pick random element from array using seed
     * @param {string} seed - The random seed
     * @param {Array} array - Array to pick from
     * @returns {*}
     */
    static pickRandom(seed, array) {
        const index = this.randomInRange(seed, 0, array.length);
        return array[index];
    }

    /**
     * Verify a game result using published hash and revealed seed
     * @param {string} seed - Revealed seed
     * @param {string} hash - Published hash before game
     * @returns {boolean}
     */
    static verify(seed, hash) {
        const computedHash = crypto.createHash('sha256').update(seed).digest('hex');
        return computedHash === hash;
    }

    /**
     * Generate weighted random (e.g., 70% red, 20% black, 10% green)
     * @param {string} seed
     * @param {object} weights - { 'red': 70, 'black': 20, 'green': 10 }
     * @returns {string}
     */
    static weightedRandom(seed, weights) {
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        const random = this.randomInRange(seed, 0, total);
        
        let cumulative = 0;
        for (const [key, weight] of Object.entries(weights)) {
            cumulative += weight;
            if (random < cumulative) {
                return key;
            }
        }
        return Object.keys(weights)[0];
    }

    /**
     * Deterministic uniform value in [0,1) from seed using 52 bits of precision
     */
    static uniform(seed) {
        const hash = crypto.createHash('sha256').update(seed).digest('hex');
        // Use first 13 hex chars = 52 bits
        const int = parseInt(hash.substring(0, 13), 16);
        const denom = Math.pow(2, 52);
        return int / denom;
    }

    /**
     * Crash multiplier generator (heavy-tail), capped
     * Not a copy of any proprietary formula; simple fair transform.
     * m = max(1.0, min(maxCap, (1 - edge) / (1 - u)))
     */
    static crashMultiplier(seed, houseEdge = 0.01, maxCap = 100) {
        let u = this.uniform(seed);
        if (u >= 0.999999999999) u = 0.999999999999; // avoid div by zero
        const raw = (1 - houseEdge) / (1 - u);
        const capped = Math.min(maxCap, Math.max(1.0, raw));
        return Math.round(capped * 100) / 100; // 2 decimals
    }
}

module.exports = FairRNG;
