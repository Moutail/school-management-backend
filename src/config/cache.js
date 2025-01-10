// src/config/cache.js
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;

if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3
    });

    redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        logger.info('Redis Client Connected');
    });
} else {
    // Fallback à un cache en mémoire si Redis n'est pas configuré
    const NodeCache = require('node-cache');
    redisClient = new NodeCache({
        stdTTL: 300, // 5 minutes par défaut
        checkperiod: 60
    });
}

const cache = {
    async get(key) {
        try {
            const value = await redisClient.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Cache Get Error:', error);
            return null;
        }
    },

    async set(key, value, expiresIn = 300) {
        try {
            await redisClient.set(
                key,
                JSON.stringify(value),
                'EX',
                expiresIn
            );
            return true;
        } catch (error) {
            logger.error('Cache Set Error:', error);
            return false;
        }
    },

    async del(key) {
        try {
            await redisClient.del(key);
            return true;
        } catch (error) {
            logger.error('Cache Del Error:', error);
            return false;
        }
    },

    async clear() {
        try {
            await redisClient.flushall();
            return true;
        } catch (error) {
            logger.error('Cache Clear Error:', error);
            return false;
        }
    }
};

module.exports = cache;

