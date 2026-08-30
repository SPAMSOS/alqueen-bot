require('dotenv').config();

const config = {
    // Discord
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.CLIENT_ID,
        guildId: process.env.GUILD_ID,
        adminRoleId: process.env.ADMIN_ROLE_ID,
        supportRoleId: process.env.SUPPORT_ROLE_ID,
        ticketCategoryId: process.env.TICKET_CATEGORY_ID,
        logChannelId: process.env.LOG_CHANNEL_ID,
        transcriptChannelId: process.env.TRANSCRIPT_CHANNEL_ID
    },

    // Bot owner(s) - comma-separated Discord IDs in BOT_OWNER_IDS env
    bot: {
        ownerId: process.env.BOT_OWNER_IDS || ''
    },

    // Dashboard
    dashboard: {
        port: process.env.PORT || 3000,
        url: process.env.DASHBOARD_URL || 'http://localhost:3000',
        sessionSecret: process.env.SESSION_SECRET || 'alqueen-secret-key'
    },

    // Database
    database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/alqueen-tickets'
    },

    // Security
    security: {
        jwtSecret: process.env.JWT_SECRET || 'alqueen-jwt-secret',
        encryptionKey: process.env.ENCRYPTION_KEY || 'alqueen-encryption-key-32ch'
    },

    // Ticket Settings
    ticket: {
        maxTicketsPerUser: 5,
        defaultTicketLimit: 5,
        autoCloseDelay: 0, // minutes, 0 = disabled
        requireReason: true,
        allowTranscript: true,
        ratingEnabled: true
    },

    // Embed Colors
    colors: {
        primary: 0x5865F2,      // Blurple
        success: 0x57F287,       // Green
        warning: 0xFEE75C,       // Yellow
        danger: 0xED4245,        // Red
        info: 0x3498DB,          // Blue
        premium: 0xFAA61A        // Gold/Premium
    },

    // Premium Features
    premium: {
        enabled: true,
        perks: [
            'priority_support',
            'unlimited_tickets',
            'custom_branding',
            'analytics_advanced',
            'auto_response',
            'ticket_forms'
        ]
    }
};

module.exports = config;
