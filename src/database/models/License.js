const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
    // Unique code (e.g., "ALQ-XXXX-XXXX-XXXX")
    code: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // Duration in days
    durationDays: {
        type: Number,
        required: true,
        default: 30
    },
    // Whether the code is still usable
    isActive: {
        type: Boolean,
        default: true
    },
    // The guild that used this code (null if not used yet)
    usedBy: {
        guildId: { type: String, default: null },
        guildName: { type: String, default: null },
        ownerId: { type: String, default: null }
    },
    usedAt: {
        type: Date,
        default: null
    },
    // When the activation expires (set when used)
    expiresAt: {
        type: Date,
        default: null
    },
    // Note from the owner
    note: {
        type: String,
        default: ''
    },
    // When the owner created this code
    createdAt: {
        type: Date,
        default: Date.now
    },
    // Who created the code (for audit)
    createdBy: {
        type: String,
        default: 'owner'
    }
});

licenseSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('License', licenseSchema);
