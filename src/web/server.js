const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');

const config = require('../config/settings');

class WebServer {
    constructor(client) {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });
        this.client = client;
        this.port = config.dashboard.port;

        // Connect bot to dashboard
        this.client.dashboardIO = this.io;

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandler();
        this.setupSocket();
    }

    setupMiddleware() {
        this.app.use(helmet({
            contentSecurityPolicy: false
        }));

        this.app.use(cors());
        // JSON limit raised to 30MB to support base64 image uploads (up to 25MB images)
        this.app.use(express.json({ limit: '30mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '30mb' }));
        this.app.use(express.static(path.join(__dirname, 'public')));

        this.app.use(session({
            secret: config.dashboard.sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 7,
                httpOnly: true,
                secure: false
            }
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100
        });
        this.app.use('/api/', limiter);
    }

    setupRoutes() {
        const apiRoutes = require('./routes/api');
        const authRoutes = require('./routes/auth');

        this.app.use('/api', apiRoutes);
        this.app.use('/auth', authRoutes);

        // Main page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Dashboard page
        this.app.get('/dashboard', (req, res) => {
            if (!req.session.user) {
                return res.redirect('/');
            }
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });

        // Server-specific dashboard
        this.app.get('/dashboard/:guildId', (req, res) => {
            if (!req.session.user) {
                return res.redirect('/');
            }
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });

        // Premium page
        this.app.get('/premium', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'premium.html'));
        });
    }

    setupErrorHandler() {
        // Express body-parser error handler — return JSON instead of HTML
        this.app.use((err, req, res, next) => {
            if (err && err.type === 'entity.too.large') {
                return res.status(413).json({
                    success: false,
                    error: 'حجم الطلب كبير جداً. الحد الأقصى 30MB.'
                });
            }
            if (err && err.type === 'entity.parse.failed') {
                return res.status(400).json({
                    success: false,
                    error: 'صيغة JSON غير صحيحة: ' + (err.message || 'parse error')
                });
            }
            console.error('Server error:', err);
            res.status(500).json({
                success: false,
                error: err?.message || 'Internal server error'
            });
        });
    }

    setupSocket() {
        this.io.on('connection', (socket) => {
            console.log('🔌 Dashboard client connected:', socket.id);

            socket.on('joinGuild', (guildId) => {
                socket.join(`guild:${guildId}`);
            });

            socket.on('joinAll', () => {
                socket.join('all-guilds');
            });

            socket.on('disconnect', () => {
                console.log('🔌 Dashboard client disconnected:', socket.id);
            });
        });

        // Send bot stats every 10 seconds to all-guilds room
        setInterval(async () => {
            if (this.client && this.client.user) {
                const stats = await this.client.getStats();
                this.io.to('all-guilds').emit('botStats', {
                    guilds: stats.guilds,
                    users: stats.users,
                    ping: stats.ping,
                    uptime: stats.uptime
                });

                // Also send per-guild stats for connected guilds
                this.client.guilds.cache.forEach(guild => {
                    this.io.to(`guild:${guild.id}`).emit('guildStats', {
                        guildId: guild.id,
                        memberCount: guild.memberCount,
                        name: guild.name
                    });
                });
            }
        }, 10000);
    }

    start() {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`🌐 Web dashboard running on http://localhost:${this.port}`);
                resolve();
            });
        });
    }
}

module.exports = WebServer;
