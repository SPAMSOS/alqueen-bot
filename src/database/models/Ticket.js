const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        required: true,
        unique: true
    },
    guildId: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    userTag: {
        type: String,
        required: true
    },
    category: {
        id: String,
        name: String,
        emoji: String
    },
    subject: {
        type: String,
        default: 'بدون عنوان'
    },
    description: {
        type: String,
        default: ''
    },
    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['open', 'pending', 'answered', 'closed'],
        default: 'open'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    assignedTo: {
        userId: String,
        userTag: String
    },
    messages: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    feedback: String,
    transcriptUrl: String,
    closedBy: {
        userId: String,
        userTag: String,
        reason: String,
        at: Date
    },
    firstResponseAt: Date,
    closedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

ticketSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes
ticketSchema.index({ guildId: 1, status: 1 });
ticketSchema.index({ userId: 1 });
ticketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
