// config/index.js
require('dotenv').config();

module.exports = {
    app: {
        port: process.env.PORT || 5000,
        env: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        corsOrigins: process.env.CORS_ORIGINS ? 
            process.env.CORS_ORIGINS.split(',') : 
            ['http://localhost:3000']
    },
    db: {
        uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_management',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            autoIndex: process.env.NODE_ENV !== 'production'
        }
    },
    security: {
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
        bcryptRounds: 12
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/app.log'
    }
};