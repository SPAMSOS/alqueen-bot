const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    tag: {
        type: String,
        required: true
    },
    username: String,
    discriminator: String,
    avatar: String,
    guilds: [{
        guildId: String,
        joinedAt: Date
    }],
    stats: {
        totalTickets: { type: Number, default: 0 },
        openTickets: { type: Number, default: 0 },
        closedTickets: { type: Number, default: 0 },
        avgRating: { type: Number, default: 0 },
        totalRatings: { type: Number, default: 0 }
    },
    preferences: {
        notifications: { type: Boolean, default: true },
        language: { type: String, default: 'ar' },
        theme: { type: String, default: 'dark' }
    },
    premium: {
        active: { type: Boolean, default: false },
        tier: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
        features: [String],
        expiresAt: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastSeen: Date
});

module.exports = mongoose.model('User', userSchema);
