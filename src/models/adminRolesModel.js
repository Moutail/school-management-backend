// src/models/adminRolesModel.js
const mongoose = require('mongoose');

const adminPrivilegeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'STUDENT_ADMIN', 'BASIC_ADMIN'],
        required: true
    },
    permissions: [{
        type: String,
        enum: [
            'MANAGE_USERS',
            'VIEW_FINANCES',
            'MANAGE_FINANCES',
            'BLOCK_STUDENTS',
            'EDIT_STUDENT_INFO',
            'VIEW_REPORTS',
            'MANAGE_PERIODS',
            'GRANT_PERMISSIONS'
        ]
    }]
});

// Mapping des permissions par rôle
const rolePermissions = {
    SUPER_ADMIN: [
        'MANAGE_USERS',
        'VIEW_FINANCES',
        'MANAGE_FINANCES',
        'BLOCK_STUDENTS',
        'EDIT_STUDENT_INFO',
        'VIEW_REPORTS',
        'MANAGE_PERIODS',
        'GRANT_PERMISSIONS'
    ],
    FINANCE_ADMIN: [
        'VIEW_FINANCES',
        'MANAGE_FINANCES',
        'BLOCK_STUDENTS'
    ],
    STUDENT_ADMIN: [
        'EDIT_STUDENT_INFO',
        'VIEW_REPORTS'
    ],
    BASIC_ADMIN: [
        'VIEW_REPORTS'
    ]
};

adminPrivilegeSchema.pre('save', function(next) {
    if (!this.permissions || this.permissions.length === 0) {
        this.permissions = rolePermissions[this.role];
    }
    next();
});

module.exports = mongoose.model('AdminPrivilege', adminPrivilegeSchema);