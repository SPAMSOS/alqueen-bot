const { Events } = require('discord.js');
const Ticket = require('../../database/models/Ticket');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // Ignore bots
        if (message.author.bot) return;

        // Check if this is a ticket channel
        if (message.channel.name?.startsWith('ticket-') || message.channel.name?.startsWith('تكت-')) {
            try {
                const ticket = await Ticket.findOne({ channelId: message.channel.id });
                if (ticket) {
                    ticket.messages = (ticket.messages || 0) + 1;
                    if (!ticket.firstResponseAt && message.author.bot === false) {
                        ticket.firstResponseAt = new Date();
                    }
                    await ticket.save();

                    // Notify dashboard via WebSocket
                    if (client.dashboardIO) {
                        client.dashboardIO.to(`guild:${ticket.guildId}`).emit('ticketMessage', {
                            ticketId: ticket.ticketId,
                            author: message.author.tag,
                            content: message.content,
                            timestamp: new Date()
                        });
                    }
                }
            } catch (error) {
                console.error('Error tracking message:', error);
            }
        }
    }
};
