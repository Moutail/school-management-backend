// src/utils/storage.js
const fileService = require('../services/fileService');

const storage = {
    async uploadToStorage(file, options = {}) {
        return await fileService.saveFile(file, options.directory || '');
    },

    async deleteFromStorage(filePath) {
        return await fileService.deleteFile(filePath);
    },

    async getFileStream(filePath) {
        return await fileService.getFile(filePath);
    }
};

module.exports = storage;