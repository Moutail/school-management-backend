// src/utils/taskScheduler.js
const cron = require('node-cron');
const fileService = require('../services/fileService');

// Nettoyage quotidien des fichiers temporaires
cron.schedule('0 0 * * *', async () => {
    console.log('Début du nettoyage des fichiers temporaires');
    await fileService.cleanTempFiles();
    console.log('Nettoyage des fichiers temporaires terminé');
});