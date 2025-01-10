// rc/middleware/securityMiddleware.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const setupSecurity = (app) => {
    // Basic security headers
    app.use(helmet());
    
    // Additional security settings
    app.use(helmet.xssFilter());
    app.use(helmet.noSniff());
    app.use(helmet.hidePoweredBy());
    app.use(helmet.frameguard({ action: 'deny' }));
    
    // HSTS
    app.use(helmet.hsts({
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }));
};

module.exports = { setupSecurity };