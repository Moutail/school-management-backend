// src/utils/validator.js
const Joi = require('joi');

const schemas = {
    register: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        role: Joi.string().valid('student', 'professor', 'admin', 'parent', 'major').required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required()
    }),
    attendance: Joi.object({
        status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').required(),
        date: Joi.date().iso().required(),
        studentId: Joi.string().hex().length(24).required(),
        courseId: Joi.string().hex().length(24).required()
    })
};

module.exports = schemas;