require('dotenv').config();
const { initDatabase } = require('../config/database');
const logger = require('../config/logger');

logger.info('Initializing database...');

try {
    initDatabase();
    logger.info('Database initialized successfully!');
    logger.info('Tables created:');
    logger.info('  - users');
    logger.info('  - balances');
    logger.info('  - transactions');
    logger.info('  - game_results');
    logger.info('  - achievements');
    logger.info('  - daily_streaks');
    logger.info('  - refresh_tokens');
} catch (error) {
    logger.error('Failed to initialize database', { error: error.message, stack: error.stack });
    process.exit(1);
}
