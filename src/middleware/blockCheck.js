// src/middleware/blockCheck.js
const blockCheck = async (req, res, next) => {
    if (req.user.isBlocked) {
      return res.status(403).json({
        message: "Accès bloqué - Contactez l'administration"
      });
    }
    next();
  };
  
  module.exports = blockCheck;