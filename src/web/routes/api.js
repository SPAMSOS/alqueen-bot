const express = require('express');
const router = express.Router();
const Guild = require('../../database/models/Guild');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');
const { sendOrUpdatePanel, DEFAULT_BUTTONS } = require('../../bot/utils/panelBuilder');

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

// Public landing page stats (no auth required)
router.get('/public/stats', async (req, res) => {
    try {
        const client = req.app.locals.client;
        const totalGuilds = client?.guilds?.cache?.size || 0;
        const totalTickets = await Ticket.countDocuments();
        const closedTickets = await Ticket.countDocuments({ status: 'closed' });
        const totalUsers = client?.users?.cache?.size || 0;

        // Calculate satisfaction rate from tickets with ratings
        const ratedTickets = await Ticket.countDocuments({ 'rating.score': { $exists: true, $ne: null } });
        const positiveRatings = await Ticket.countDocuments({ 'rating.score': { $gte: 4 } });
        const satisfactionRate = ratedTickets > 0 ? Math.round((positiveRatings / ratedTickets) * 100) : 100;

        res.json({
            success: true,
            data: {
                guilds: totalGuilds,
                tickets: totalTickets,
                closedTickets: closedTickets,
                users: totalUsers,
                satisfaction: satisfactionRate
            }
        });
    } catch (error) {
        res.json({
            success: true,
            data: { guilds: 0, tickets: 0, closedTickets: 0, users: 0, satisfaction: 100 }
        });
    }
});

// Get user's guilds (with bot) - filtered to only servers user can access
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

// Get ALL guilds from DB (admin only, not filtered by user)
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

// Get guild panel info (message ID and channel ID)
router.get('/guilds/:guildId/panel', async (req, res) => {
    try {
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const client = req.app.locals.client;
        const panelChannelId = guild.settings?.panelChannelId;
        const panelMessageId = guild.panelMessageId;
        let panelMessage = null;
        let availableChannels = [];

        if (client) {
            const botGuild = client.guilds.cache.get(req.params.guildId);
            if (botGuild) {
                availableChannels = botGuild.channels.cache
                    .filter(c => c.isTextBased() && c.permissionsFor(botGuild.members.me)?.has('SendMessages'))
                    .map(c => ({ id: c.id, name: c.name, type: c.type }))
                    .slice(0, 50);
            }
        }

        if (panelChannelId && client) {
            try {
                const channel = await client.channels.fetch(panelChannelId);
                if (channel) {
                    // Try saved message ID first
                    if (panelMessageId) {
                        const msg = await channel.messages.fetch(panelMessageId).catch(() => null);
                        if (msg) {
                            panelMessage = {
                                id: msg.id,
                                content: msg.content,
                                embeds: msg.embeds?.map(e => e.toJSON())
                            };
                        }
                    }
                    // Fallback: find most recent bot message with components
                    if (!panelMessage) {
                        const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
                        if (recent) {
                            const botMsg = recent.find(m => m.author.id === client.user.id && m.components?.length > 0);
                            if (botMsg) {
                                panelMessage = {
                                    id: botMsg.id,
                                    content: botMsg.content,
                                    embeds: botMsg.embeds?.map(e => e.toJSON())
                                };
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to fetch panel message:', e.message);
            }
        }

        res.json({
            success: true,
            data: {
                channelId: panelChannelId,
                message: panelMessage,
                availableChannels: availableChannels,
                panelSettings: guild.panelSettings || {
                    title: '✨ نظام الدعم الفني الاحترافي ✨',
                    description: 'اختر نوع طلبك من الأزرار أدناه',
                    color: '5865F2',
                    footer: '🎫 ALQUEEN Ticket System',
                    buttons: DEFAULT_BUTTONS
                },
                settings: guild.settings,
                needsSetup: !panelChannelId
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get guild's custom emojis
router.get('/guilds/:guildId/emojis', async (req, res) => {
    try {
        const client = req.app.locals.client;
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not connected' });
        }

        const botGuild = client.guilds.cache.get(req.params.guildId);
        if (!botGuild) {
            return res.status(404).json({ success: false, error: 'البوت ليس في هذا السيرفر' });
        }

        const emojis = botGuild.emojis.cache.map(e => ({
            id: e.id,
            name: e.name,
            animated: e.animated,
            url: e.imageURL({ size: 64 }),
            identifier: e.identifier, // e.g. "name" for <:name:id> or "name" for animated
            formatted: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`
        })).sort((a, b) => a.name.localeCompare(b.name));

        res.json({ success: true, data: emojis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update panel channel (where panel is posted)
router.put('/guilds/:guildId/panel/channel', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { channelId } = req.body;

        const guild = await Guild.findOneAndUpdate(
            { guildId },
            { $set: { 'settings.panelChannelId': channelId } },
            { new: true }
        );

        // Reset message ID since we changed channel
        await Guild.updateOne({ guildId }, { $unset: { panelMessageId: 1 } });

        res.json({ success: true, data: guild.settings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload image via Discord (use Discord's CDN as host)
router.post('/guilds/:guildId/upload-image', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { imageData, type } = req.body; // base64 image data + type ('banner' or 'thumbnail')
        const client = req.app.locals.client;

        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not connected' });
        }
        if (!imageData) {
            return res.status(400).json({ success: false, error: 'No image data' });
        }

        const guild = await Guild.findOne({ guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // Use the log channel or first available text channel to upload
        let uploadChannel = null;
        if (guild.settings?.logChannelId) {
            uploadChannel = await client.channels.fetch(guild.settings.logChannelId).catch(() => null);
        }
        if (!uploadChannel && guild.settings?.transcriptChannelId) {
            uploadChannel = await client.channels.fetch(guild.settings.transcriptChannelId).catch(() => null);
        }
        if (!uploadChannel) {
            // Fallback: any text channel
            const botGuild = client.guilds.cache.get(guildId);
            if (botGuild) {
                uploadChannel = botGuild.channels.cache.find(c =>
                    c.isTextBased() && c.permissionsFor(botGuild.members.me)?.has('SendMessages')
                );
            }
        }

        if (!uploadChannel) {
            return res.status(404).json({ success: false, error: 'لا توجد قناة متاحة لرفع الصورة. شغّل /setup أولاً.' });
        }

        // Convert base64 to buffer
        const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ success: false, error: 'Invalid image format' });
        }
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');

        // Size limit (10MB minimum, up to 25MB for nitro servers)
        const maxSize = (uploadChannel.guild?.premiumTier > 0) ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
        if (buffer.length > maxSize) {
            const limitMB = maxSize / (1024 * 1024);
            return res.status(400).json({
                success: false,
                error: `حجم الصورة كبير. الحد ${limitMB}MB${uploadChannel.guild?.premiumTier > 0 ? ' (سيرفر Nitro)' : ''}.`
            });
        }

        // Upload to Discord (hidden message)
        const msg = await uploadChannel.send({
            content: '🔒 صورة لوحة (احذفني بعد التحميل - لكن لا تحذف الصورة بعد)',
            files: [{ attachment: buffer, name: `panel-${type || 'image'}-${Date.now()}.${ext}` }]
        });

        // Get the URL
        const attachment = msg.attachments.first();
        const url = attachment?.url;

        // Delete the temp message immediately
        setTimeout(() => msg.delete().catch(() => {}), 2000);

        if (!url) {
            return res.status(500).json({ success: false, error: 'فشل رفع الصورة' });
        }

        res.json({ success: true, url: url });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update guild panel settings (DB only)
router.put('/guilds/:guildId/panel/settings', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { title, description, color, image, thumbnail, footer, buttons } = req.body;

        const update = {};
        if (title !== undefined) update['panelSettings.title'] = title;
        if (description !== undefined) update['panelSettings.description'] = description;
        if (color !== undefined) update['panelSettings.color'] = color;
        if (image !== undefined) update['panelSettings.image'] = image;
        if (thumbnail !== undefined) update['panelSettings.thumbnail'] = thumbnail;
        if (footer !== undefined) update['panelSettings.footer'] = footer;
        if (buttons !== undefined) update['panelSettings.buttons'] = buttons;

        const guild = await Guild.findOneAndUpdate(
            { guildId },
            { $set: update },
            { new: true, upsert: true }
        );

        res.json({ success: true, data: guild.panelSettings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update guild panel (edit the Discord message + DB settings)
router.put('/guilds/:guildId/panel', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { title, description, color, image, thumbnail, footer, buttons, sendNew, channelId } = req.body;
        const client = req.app.locals.client;

        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not connected' });
        }

        const guild = await Guild.findOne({ guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // If user provided a new channelId, update it first
        let panelChannelId = guild.settings?.panelChannelId;
        if (channelId && channelId !== panelChannelId) {
            await Guild.updateOne({ guildId }, {
                $set: { 'settings.panelChannelId': channelId },
                $unset: { panelMessageId: 1 }
            });
            panelChannelId = channelId;
        }

        if (!panelChannelId) {
            return res.status(400).json({
                success: false,
                error: 'لم يتم تحديد قناة اللوحة. شغّل /setup في السيرفر أولاً أو اختر قناة من الإعدادات.'
            });
        }

        // Update DB settings
        const newPanelSettings = {
            ...(guild.panelSettings || {}),
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(color !== undefined && { color }),
            ...(image !== undefined && { image }),
            ...(thumbnail !== undefined && { thumbnail }),
            ...(footer !== undefined && { footer }),
            ...(buttons !== undefined && { buttons })
        };

        const channel = await client.channels.fetch(panelChannelId).catch(() => null);
        if (!channel) {
            return res.status(404).json({
                success: false,
                error: 'قناة اللوحة غير موجودة في ديسكورد. تأكد أن البوت موجود في السيرفر.'
            });
        }

        // Always send new message on sendNew, or if messageId is missing
        let result;
        if (sendNew) {
            const { buildPanelEmbed, buildPanelButtons } = require('../../bot/utils/panelBuilder');
            const embed = buildPanelEmbed(newPanelSettings, channel.guild.name);
            const rows = buildPanelButtons(newPanelSettings);
            const msg = await channel.send({ embeds: [embed], components: rows });
            result = { message: msg, action: 'sent' };
        } else {
            // Update existing (or fallback to recent bot message with components)
            result = await sendOrUpdatePanel(client, channel, {
                ...newPanelSettings,
                messageId: guild.panelMessageId
            }, channel.guild.name);
        }

        // Save to DB
        await Guild.updateOne(
            { guildId },
            {
                $set: {
                    panelSettings: newPanelSettings,
                    panelMessageId: result.message.id
                }
            }
        );

        res.json({
            success: true,
            action: result.action,
            messageId: result.message.id,
            channelId: panelChannelId,
            data: newPanelSettings
        });
    } catch (error) {
        console.error('Panel update error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a ticket from web dashboard
router.delete('/guilds/:guildId/tickets/:ticketId', async (req, res) => {
    try {
        const { guildId, ticketId } = req.params;
        const ticket = await Ticket.findOne({ ticketId, guildId });

        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        // Delete from Discord if channel exists
        if (req.app.locals.client && ticket.channelId) {
            try {
                const channel = await req.app.locals.client.channels.fetch(ticket.channelId);
                if (channel) await channel.delete();
            } catch (e) {
                console.error('Failed to delete channel:', e.message);
            }
        }

        // Delete from DB
        await Ticket.deleteOne({ ticketId, guildId });
        await TicketLog.deleteMany({ ticketId });

        // Notify via socket
        const io = req.app.locals.io;
        if (io) {
            io.to(`guild:${guildId}`).emit('ticketDeleted', { ticketId, guildId });
        }

        res.json({ success: true, message: 'Ticket deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get guild members for ticket assignment
router.get('/guilds/:guildId/members', async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.app.locals.client;

        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not connected' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const members = await guild.members.fetch();
        const memberList = members.map(m => ({
            id: m.id,
            username: m.user.username,
            tag: m.user.tag,
            displayName: m.displayName,
            avatar: m.user.displayAvatarURL({ size: 64 }),
            roles: m.roles.cache.map(r => ({ id: r.id, name: r.name })),
            isAdmin: m.permissions.has('Administrator')
        }));

        res.json({ success: true, data: memberList });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update ticket status
router.put('/tickets/:ticketId/status', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status } = req.body;

        const ticket = await Ticket.findOne({ ticketId });
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        ticket.status = status;
        if (status === 'closed') {
            ticket.closedAt = new Date();
        }

        await ticket.save();

        // Notify via socket
        const io = req.app.locals.io;
        if (io) {
            io.to(`guild:${ticket.guildId}`).emit('ticketUpdated', {
                ticketId,
                guildId: ticket.guildId,
                status
            });
        }

        res.json({ success: true, data: ticket });
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
