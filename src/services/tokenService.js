// 4. Service de gestion des tokens (services/tokenService.js)
const jwt = require('jsonwebtoken');
const config = require('../config');
const Token = require('../models/tokenModel');
const { AppError } = require('../middleware/errorHandler');

class TokenService {
    static generateTokens(userId) {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET not configured');
        }

        const accessToken = jwt.sign(
            { userId },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            { userId },
            process.env.REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return { accessToken, refreshToken };
    }

    static async saveRefreshToken(userId, token) {
        await Token.create({ userId, token });
    }

    static async verifyToken(token, isRefreshToken = false) {
        try {
            const secret = isRefreshToken ? process.env.REFRESH_SECRET : process.env.JWT_SECRET;
            return jwt.verify(token, secret);
        } catch (error) {
            throw new AppError(
                `Token ${isRefreshToken ? 'de rafraîchissement' : 'd\'accès'} invalide`,
                401
            );
        }
    }

    static async refreshTokens(refreshToken) {
        try {
            const decoded = await this.verifyToken(refreshToken, true);
            const tokenDoc = await Token.findOne({ userId: decoded.userId, token: refreshToken });
            
            if (!tokenDoc) {
                throw new AppError('Token de rafraîchissement invalide ou expiré', 401);
            }

            const newTokens = this.generateTokens(decoded.userId);
            
            // Mise à jour du refresh token en base
            await Token.findByIdAndUpdate(tokenDoc._id, { token: newTokens.refreshToken });

            return newTokens;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Erreur lors du rafraîchissement des tokens', 500);
        }
    }
}

module.exports = TokenService;