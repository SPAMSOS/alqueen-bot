const mongoose = require('mongoose');

const ticketLogSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    ticketId: {
        type: String,
        required: true
    },
    action: {
        type: String,
        enum: [
            'created',
            'opened',
            'closed',
            'reopened',
            'deleted',
            'renamed',
            'priority_changed',
            'assigned',
            'unassigned',
            'user_added',
            'user_removed',
            'category_changed',
            'note_added',
            'rating_given'
        ],
        required: true
    },
    performedBy: {
        userId: String,
        userTag: String,
        type: {
            type: String,
            enum: ['user', 'staff', 'system'],
            default: 'user'
        }
    },
    target: {
        userId: String,
        userTag: String
    },
    details: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

ticketLogSchema.index({ guildId: 1, timestamp: -1 });
ticketLogSchema.index({ ticketId: 1 });

module.exports = mongoose.model('TicketLog', ticketLogSchema);
