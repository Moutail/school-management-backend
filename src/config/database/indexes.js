// src/config/database/indexes.js
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Course = mongoose.model('Course');
const Attendance = mongoose.model('Attendance');
const Document = mongoose.model('Document');
const MajorPrivileges = mongoose.model('MajorPrivileges');
const Tuition = mongoose.model('Tuition');
const AcademicPeriod = mongoose.model('AcademicPeriod');

const setupIndexes = async () => {
    try {
        console.log('Configuration des index de la base de données...');

        // Index pour User
        await User.collection.createIndexes([
            { key: { email: 1 }, unique: true },
            { key: { username: 1 }, unique: true },
            { key: { role: 1 } },
            { key: { class: 1, role: 1 } },
            { key: { 'children': 1 }, sparse: true },
            { key: { username: 'text', firstName: 'text', lastName: 'text' } }
        ]);

        // Index pour Course
        await Course.collection.createIndexes([
            { key: { code: 1 }, unique: true },
            { key: { professor: 1 } },
            { key: { 'classes.class': 1 } },
            { key: { 'periods.period': 1 } },
            { key: { title: 'text', description: 'text' } }
        ]);

        // Index pour Attendance
        await Attendance.collection.createIndexes([
            { key: { student: 1, date: 1 } },
            { key: { course: 1, date: 1 } },
            { key: { date: 1 } },
            { key: { status: 1 } },
            { key: { 'justification.status': 1 } }
        ]);

        // Index pour Document
        await Document.collection.createIndexes([
            { key: { course: 1 } },
            { key: { uploadedBy: 1 } },
            { key: { 'academicPeriod': 1 } },
            { key: { type: 1 } }
        ]);

        // Index pour MajorPrivileges
        await MajorPrivileges.collection.createIndexes([
            { key: { user: 1, class: 1, academicYear: 1 }, unique: true },
            { key: { class: 1 } },
            { key: { 'activities.deadline': 1 } }
        ]);

        // Index pour Tuition
        await Tuition.collection.createIndexes([
            { key: { student: 1, academicYear: 1 }, unique: true },
            { key: { status: 1 } },
            { key: { isBlocked: 1 } },
            { key: { nextPaymentDue: 1 } }
        ]);

        // Index pour AcademicPeriod
        await AcademicPeriod.collection.createIndexes([
            { key: { startDate: 1 } },
            { key: { endDate: 1 } },
            { key: { status: 1 } }
        ]);

        console.log('Configuration des index terminée avec succès');
    } catch (error) {
        console.error('Erreur lors de la configuration des index:', error);
        throw error;
    }
};

// Fonction pour vérifier les index existants
const checkIndexes = async () => {
    const collections = [
        { name: 'User', model: User },
        { name: 'Course', model: Course },
        { name: 'Attendance', model: Attendance },
        { name: 'Document', model: Document },
        { name: 'MajorPrivileges', model: MajorPrivileges },
        { name: 'Tuition', model: Tuition },
        { name: 'AcademicPeriod', model: AcademicPeriod }
    ];

    for (const collection of collections) {
        try {
            const indexes = await collection.model.collection.getIndexes();
            console.log(`Index pour ${collection.name}:`, indexes);
        } catch (error) {
            console.error(`Erreur lors de la vérification des index pour ${collection.name}:`, error);
        }
    }
};

module.exports = {
    setupIndexes,
    checkIndexes
};