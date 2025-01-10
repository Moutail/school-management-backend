// src/config/database/init.js
const { setupIndexes, checkIndexes } = require('./indexes');
const mongoose = require('mongoose');
const config = require('../index');

const initializeDatabase = async () => {
    try {
        // Connexion à MongoDB
        await mongoose.connect(config.db.uri, config.db.options);
        console.log('Connexion à MongoDB établie');

        // Configuration des index
        await setupIndexes();
        
        // Vérification des index en développement
        if (config.app.env === 'development') {
            await checkIndexes();
        }

        console.log('Initialisation de la base de données terminée');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de la base de données:', error);
        process.exit(1);
    }
};

module.exports = initializeDatabase;

// Utilisation dans server.js
const initializeDatabase = require('./config/database/init');

// Au démarrage de l'application
initializeDatabase().then(() => {
    app.listen(config.app.port, () => {
        console.log(`Serveur démarré sur le port ${config.app.port}`);
    });
}).catch(error => {
    console.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
});