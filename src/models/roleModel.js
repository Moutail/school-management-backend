// src/models/roleModel.js
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['admin', 'professor', 'student', 'parent', 'major']
  },
  permissions: [{
    type: String,
    required: true
  }],
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pour mettre à jour la date de modification
roleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Role = mongoose.model('Role', roleSchema);

// Création des rôles par défaut
const defaultRoles = [
  {
    name: 'admin',
    permissions: ['all'],
    description: 'Administrateur système avec tous les droits'
  },
  {
    name: 'professor',
    permissions: [
      'view_courses',
      'create_course',
      'edit_course',
      'delete_course',
      'grade_students',
      'manage_assignments',
      'view_analytics',
      'send_messages'
    ],
    description: 'Enseignant avec droits de gestion des cours et notes'
  },
  {
    name: 'student',
    permissions: [
      'view_courses',
      'submit_assignments',
      'view_grades',
      'send_messages',
      'view_schedule'
    ],
    description: 'Étudiant avec accès aux cours et devoirs'
  },
  {
    name: 'parent',
    permissions: [
      'view_grades',
      'view_attendance',
      'view_payments',
      'send_messages'
    ],
    description: 'Parent avec accès au suivi de l\'élève'
  },
  {
    name: 'major',
    permissions: [
      'view_courses',
      'submit_assignments',
      'view_grades',
      'send_messages',
      'view_schedule',
      'manage_class_activities'
    ],
    description: 'Major de classe avec droits supplémentaires'
  }
];

// Fonction pour initialiser les rôles par défaut
roleSchema.statics.initializeRoles = async function() {
  try {
    for (const role of defaultRoles) {
      await this.findOneAndUpdate(
        { name: role.name },
        role,
        { upsert: true, new: true }
      );
    }
    console.log('Rôles initialisés avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des rôles:', error);
  }
};

module.exports = Role;