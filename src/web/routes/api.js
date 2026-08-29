const express = require('express');
const router = express.Router();
const Guild = require('../../database/models/Guild');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');

// Bot stats
router.get('/stats', async (req, res) => {
    try {
        const client = req.app.locals.client;
        const guilds = await Guild.find();
        const totalTickets = await Ticket.countDocuments();
        const openTickets = await Ticket.countDocuments({ status: 'open' });
        const closedTickets = await Ticket.countDocuments({ status: 'closed' });

        const botStats = client ? await client.getStats() : {};
        const botInfo = client?.user ? {
            username: client.user.username,
            id: client.user.id,
            avatar: client.user.displayAvatarURL(),
            avatarUrl: client.user.displayAvatarURL({ size: 256, dynamic: true })
        } : {};

        res.json({
            success: true,
            data: {
                bot: { ...botStats, ...botInfo },
                tickets: {
                    total: totalTickets,
                    open: openTickets,
                    closed: closedTickets
                },
                guilds: {
                    total: guilds.length,
                    active: guilds.filter(g => g.stats && g.stats.openTickets > 0).length
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's guilds (with bot)
router.get('/guilds', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const client = req.app.locals.client;
        const userGuilds = req.session.user.guilds || [];

        // Get bot's actual guilds
        const botGuildIds = client ? client.guilds.cache.map(g => g.id) : [];

        // Filter user guilds to only show ones with bot
        const sharedGuilds = userGuilds.filter(g => botGuildIds.includes(g.guildId));

        // Get full guild info from bot
        const guildsWithInfo = await Promise.all(sharedGuilds.map(async (ug) => {
            const guildData = await Guild.findOne({ guildId: ug.guildId });
            const botGuild = client?.guilds?.cache?.get(ug.guildId);

            return {
                guildId: ug.guildId,
                name: ug.name || (botGuild ? botGuild.name : 'Unknown'),
                icon: ug.icon || (botGuild ? botGuild.icon : null),
                iconUrl: ug.icon
                    ? `https://cdn.discordapp.com/icons/${ug.guildId}/${ug.icon}.${ug.icon.startsWith('a_') ? 'gif' : 'png'}?size=128`
                    : (botGuild ? botGuild.iconURL({ size: 128, dynamic: true }) : null),
                memberCount: botGuild ? botGuild.memberCount : 0,
                owner: ug.owner,
                permissions: ug.permissions,
                settings: guildData?.settings || {},
                stats: guildData?.stats || { totalTickets: 0, openTickets: 0, closedTickets: 0 }
            };
        }));

        res.json({ success: true, data: guildsWithInfo });
    } catch (error) {
        console.error('Guilds error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all guilds in DB (admin only)
router.get('/guilds/all', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const guilds = await Guild.find().sort({ createdAt: -1 });
        res.json({ success: true, data: guilds });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get guild details
router.get('/guilds/:guildId', async (req, res) => {
    try {
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const client = req.app.locals.client;
        const botGuild = client?.guilds?.cache?.get(req.params.guildId);

        res.json({
            success: true,
            data: {
                ...guild.toObject(),
                memberCount: botGuild ? botGuild.memberCount : 0,
                online: botGuild ? botGuild.presences?.cache?.size || 0 : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get tickets for a guild
router.get('/guilds/:guildId/tickets', async (req, res) => {
    try {
        const { status, limit = 50, page = 1 } = req.query;
        const filter = { guildId: req.params.guildId };

        if (status) filter.status = status;

        const tickets = await Ticket.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Ticket.countDocuments(filter);

        res.json({
            success: true,
            data: tickets,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all tickets (recent)
router.get('/tickets', async (req, res) => {
    try {
        const { status, limit = 50, page = 1 } = req.query;
        const filter = {};

        if (status) filter.status = status;

        const tickets = await Ticket.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Ticket.countDocuments(filter);

        res.json({
            success: true,
            data: tickets,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single ticket
router.get('/tickets/:ticketId', async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        const logs = await TicketLog.find({ ticketId: req.params.ticketId })
            .sort({ timestamp: 1 });

        res.json({ success: true, data: { ticket, logs } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get guild statistics
router.get('/guilds/:guildId/statistics', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const since = new Date();
        since.setDate(since.getDate() - parseInt(days));

        const tickets = await Ticket.find({
            guildId: req.params.guildId,
            createdAt: { $gte: since }
        });

        const dailyStats = {};
        for (let i = 0; i < parseInt(days); i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = date.toISOString().split('T')[0];
            dailyStats[key] = { created: 0, closed: 0 };
        }

        tickets.forEach(ticket => {
            const key = ticket.createdAt.toISOString().split('T')[0];
            if (dailyStats[key]) {
                dailyStats[key].created += 1;
                if (ticket.status === 'closed') {
                    dailyStats[key].closed += 1;
                }
            }
        });

        const categoryStats = {};
        tickets.forEach(t => {
            const cat = t.category?.name || 'other';
            categoryStats[cat] = (categoryStats[cat] || 0) + 1;
        });

        res.json({
            success: true,
            data: {
                daily: dailyStats,
                categories: categoryStats,
                total: tickets.length,
                period: parseInt(days)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update guild settings
router.put('/guilds/:guildId/settings', async (req, res) => {
    try {
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        Object.assign(guild.settings, req.body);
        await guild.save();

        res.json({ success: true, data: guild });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Close ticket from dashboard
router.post('/tickets/:ticketId/close', async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        ticket.status = 'closed';
        ticket.closedAt = new Date();
        ticket.closedBy = {
            userId: req.session.user?.id,
            userTag: req.session.user?.tag,
            reason: req.body.reason || 'Closed from dashboard',
            at: new Date()
        };
        await ticket.save();

        // Notify via socket
        const io = req.app.locals.io;
        if (io) {
            io.to('all-guilds').emit('ticketClosed', {
                ticketId: ticket.ticketId,
                reason: ticket.closedBy.reason
            });
        }

        // Try to delete Discord channel
        if (req.app.locals.client) {
            try {
                const channel = await req.app.locals.client.channels.fetch(ticket.channelId);
                if (channel) await channel.delete();
            } catch (e) {}
        }

        res.json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
