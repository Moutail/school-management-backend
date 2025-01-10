// src/middleware/checkRole.js
const checkRole = (roles) => {
  return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
          return res.status(403).json({ 
              message: "Accès non autorisé pour ce rôle" 
          });
      }
      next();
  };
};

// Exportation simple
module.exports = checkRole;