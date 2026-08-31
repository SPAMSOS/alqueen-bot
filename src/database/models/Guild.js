const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    ownerId: {
        type: String,
        required: true
    },
    settings: {
        prefix: { type: String, default: '!' },
        language: { type: String, default: 'ar' },
        ticketCategoryId: String,
        logChannelId: String,
        transcriptChannelId: String,
        adminRoleId: String,
        supportRoleId: String,
        maxTicketsPerUser: { type: Number, default: 5 },
        autoCloseDelay: { type: Number, default: 0 },
        requireReason: { type: Boolean, default: true },
        allowTranscript: { type: Boolean, default: true },
        ratingEnabled: { type: Boolean, default: true },
        welcomeMessage: String,
        customTitle: String,
        premium: {
            enabled: { type: Boolean, default: false },
            tier: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
            expiresAt: Date
        }
    },
    ticketCategories: [{
        id: { type: String, required: true },          // support, admin, event, groups
        name: { type: String, required: true },        // دعم فني
        emoji: { type: String, default: '🎫' },
        description: String,
        requiredRoleId: { type: String, default: null }, // null = support role can see (default behavior)
        adminOnly: { type: Boolean, default: false },    // if true, support cannot see
        enabled: { type: Boolean, default: true },
        panelStyle: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Primary' },
        customFields: [{
            name: String,
            type: { type: String, enum: ['text', 'number', 'select'] },
            required: { type: Boolean, default: false },
            options: [String]
        }]
    }],
    panelSettings: {
        title: { type: String, default: '✨ نظام الدعم الفني الاحترافي ✨' },
        description: { type: String, default: 'اختر نوع طلبك من الأزرار أدناه' },
        color: { type: String, default: '5865F2' },
        image: String,
        thumbnail: String,
        footer: { type: String, default: '🎫 ALQUEEN Ticket System' },
        buttons: [{
            id: String,
            label: String,
            emoji: String,
            style: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Primary' },
            order: { type: Number, default: 0 }
        }]
    },
    panelMessageId: String,
    panelImageMessages: [{ type: String }], // Message IDs storing panel images (to keep URLs valid)
    // License activation
    license: {
        code: { type: String, default: null },
        activatedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
        revoked: { type: Boolean, default: false } // Owner can manually disable
    },
    stats: {
        totalTickets: { type: Number, default: 0 },
        openTickets: { type: Number, default: 0 },
        closedTickets: { type: Number, default: 0 },
        avgResponseTime: { type: Number, default: 0 },
        satisfactionRate: { type: Number, default: 0 }
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

guildSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Guild', guildSchema);
