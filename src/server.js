// src/server.js
const dotenv = require('dotenv');
const result = dotenv.config();

if (result.error) {
    console.error('Error loading .env file:', result.error);
    process.exit(1);
}

// Log pour vérifier que JWT_SECRET est bien chargé
console.log('JWT_SECRET is set:', !!process.env.JWT_SECRET);
console.log('REFRESH_SECRET is set:', !!process.env.REFRESH_SECRET);
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const fs = require('fs').promises;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// Import des middlewares
const errorHandler = require('./middleware/errorHandler');
const { protect } = require('./middleware/authMiddleware');



// Fonction améliorée pour importer les routes
const importRoute = (routePath) => {
    const fullPath = path.join(__dirname, routePath);
    try {
        const routeModule = require(fullPath);
        if (!routeModule || !routeModule.stack) {
            console.error(`❌ Route module ${routePath} is not a valid Express router`);
            throw new Error(`Invalid route module: ${routePath}`);
        }
        console.log(`✅ Successfully loaded route: ${routePath}`);
        return routeModule;
    } catch (error) {
        console.error(`❌ Failed to load route ${routePath}:`, error);
        process.exit(1);
    }
};

// Import des routes avec chemins relatifs
const routes = {
    auth: importRoute('routes/authRoutes'),
    user: importRoute('routes/userRoutes'),
    academic: importRoute('routes/academicRoutes'),
    blocking: importRoute('routes/blockingRoutes'),
    major: importRoute('routes/majorRoutes'),
    document: importRoute('routes/documentRoutes'),
    notification: importRoute('routes/notificationRoutes'),
    archive: importRoute('routes/archiveRoutes'),
    admin: importRoute('routes/adminRoute'),
    schedule: importRoute('routes/scheduleRoutes'),
    attendance: importRoute('routes/attendanceRoutes'),
    course: importRoute('routes/courseRoutes'),
    // Ajoutez ces deux lignes
    student: importRoute('routes/studentRoutes'),
    parent: importRoute('routes/parentRoutes')
};

const app = express();

// Configuration sécurité
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        status: 'error',
        message: 'Too many requests, please try again after 15 minutes'
    }
});
app.use('/api/', limiter);

// Configuration CORS
const corsOptions = {
    origin: process.env.NODE_ENV === 'development' 
        ? ['http://localhost:5173', 'http://localhost:3000']  // Ajoutez tous vos origines de développement
        : process.env.ALLOWED_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // Cache les résultats du preflight pendant 24 heures
};

// Appliquez les options CORS
app.use(cors(corsOptions));

// Middleware de parsing et sécurité
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(compression());

// Configuration des logs
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    const logDir = path.join(__dirname, '../logs');
    try {
        fs.mkdir(logDir, { recursive: true });
        const accessLogStream = fs.createWriteStream(
            path.join(logDir, 'access.log'),
            { flags: 'a' }
        );
        app.use(morgan('combined', { stream: accessLogStream }));
    } catch (error) {
        console.warn('⚠️ Could not set up file logging:', error);
    }
}

// Documentation API Swagger
try {
    const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
    console.warn('⚠️ swagger.yaml not found, API documentation unavailable');
}

// Configuration des fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    maxAge: '1d',
    etag: true
}));

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// Montage des routes API
app.use('/api/auth', routes.auth);
app.use('/api/users', protect, routes.user);
app.use('/api/academic', protect, routes.academic);
app.use('/api/blocking', protect, routes.blocking);
app.use('/api/major', protect, routes.major);
app.use('/api/documents', protect, routes.document);
app.use('/api/notifications', protect, routes.notification);
app.use('/api/archives', protect, routes.archive);
app.use('/api/admin', protect, routes.admin);
app.use('/api/schedule', protect, routes.schedule);
app.use('/api/attendance', protect, routes.attendance);
app.use('/api/courses', protect, routes.course);
app.use('/api/student', protect, routes.student); // Utilisez routes.student au lieu de studentRoutes
app.use('/api/parent', protect, routes.parent);   // Utilisez routes.parent au lieu de parentRoutes
// Gestion des routes non trouvées
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found`
    });
});

// Middleware de gestion des erreurs
app.use(errorHandler);

// Configuration MongoDB
const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    autoIndex: process.env.NODE_ENV !== 'production'
};

// Fonction de démarrage du serveur
const startServer = async () => {
    try {
        // Connexion MongoDB
        await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
        console.log('✅ Connected to MongoDB');

        // Création des dossiers requis
        const uploadsPath = path.join(__dirname, '../uploads');
        const requiredDirs = [
            'documents',
            'course-materials',
            'attendance-proofs',
            'temp',
            'profiles',
            'exports'
        ];

        for (const dir of requiredDirs) {
            const fullPath = path.join(uploadsPath, dir);
            await fs.mkdir(fullPath, { recursive: true })
                .catch(err => console.warn(`⚠️ Cannot create ${dir}:`, err.message));
        }

        // Démarrage du serveur HTTP
        const PORT = process.env.PORT || 5000;
        const server = app.listen(PORT, () => {
            console.log(`
🚀 Server is running
📍 Mode: ${process.env.NODE_ENV}
🌐 Port: ${PORT}
📚 API Documentation: http://localhost:${PORT}/api-docs
            `);
        });

        // Gestion de l'arrêt gracieux
        const gracefulShutdown = async (signal) => {
            console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);
            server.close(async () => {
                console.log('🔌 HTTP server closed');
                await mongoose.connection.close();
                console.log('📥 MongoDB connection closed');
                process.exit(0);
            });

            // Forcer la fermeture après 10 secondes
            setTimeout(() => {
                console.error('⚠️ Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        console.error('❌ Server startup error:', error);
        process.exit(1);
    }
};

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
    process.exit(1);
});

// Démarrage du serveur
if (require.main === module) {
    startServer();
}

module.exports = app;