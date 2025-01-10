//src/middleware/validation/index.js
const { AppError } = require('../../utils/errors');
const schemas = require('./schemas');

const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error } = schema.validate(req[source], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.context.key,
                message: detail.message
            }));

            return next(new AppError('Validation failed', 400, { errors }));
        }

        next();
    };
};

module.exports = {
    validate,
    schemas
};