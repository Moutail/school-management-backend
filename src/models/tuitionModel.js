// backend/src/models/tuitionModel.js
const mongoose = require('mongoose');

const tuitionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    academicYear: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AcademicYear',
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['PAID', 'PARTIAL', 'UNPAID', 'OVERDUE'],
        default: 'UNPAID'
    },
    payments: [{
        amount: Number,
        date: Date,
        receiptNumber: String
    }],
    nextPaymentDue: Date,
    isBlocked: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Tuition', tuitionSchema);