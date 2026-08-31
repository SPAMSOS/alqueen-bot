const express = require('express');
const router = express.Router();
const Guild = require('../../database/models/Guild');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');
const License = require('../../database/models/License');
const { sendOrUpdatePanel, DEFAULT_BUTTONS } = require('../../bot/utils/panelBuilder');
const licenseService = require('../../bot/utils/licenseService');

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
        // Use JWT cookie directly - don't rely on session store (MemoryStore loses data on restart)
        const token = req.cookies?.auth_token;
        const jwt = require('jsonwebtoken');
        const config = require('../../config/settings');
        let userData = null;

        if (token) {
            try {
                userData = jwt.verify(token, config.security.jwtSecret);
            } catch (e) {
                return res.status(401).json({ success: false, error: 'Token invalid' });
            }
        }

        if (!userData) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const client = req.app.locals.client;

        // Get guilds: prefer JWT, fall back to DB (for large user guild lists)
        let userGuilds = userData.guilds || [];
        if (userGuilds.length === 0) {
            try {
                const User = require('../../database/models/User');
                const dbUser = await User.findOne({ userId: userData.id });
                if (dbUser && Array.isArray(dbUser.guilds)) {
                    userGuilds = dbUser.guilds.map(g => ({
                        guildId: g.guildId || g.id,
                        name: g.name,
                        icon: g.icon,
                        owner: g.owner,
                        permissions: g.permissions
                    }));
                }
            } catch (e) {
                console.error('Fetch user guilds from DB:', e.message);
            }
        }
        console.log(`🔍 /api/guilds: user=${userData.username}, guildsCount=${userGuilds.length}`);

        // Get bot's actual guilds
        const botGuildIds = client ? client.guilds.cache.map(g => g.id) : [];

        // Filter user guilds to only show ones with bot
        const sharedGuilds = userGuilds.filter(g => botGuildIds.includes(g.guildId));

        // Get full guild info from bot
        const guildsWithInfo = await Promise.all(sharedGuilds.map(async (ug) => {
            const guildData = await Guild.findOne({ guildId: ug.guildId });
            const botGuild = client?.guilds?.cache?.get(ug.guildId);

            // Compute license status
            const lic = guildData?.license || {};
            let licenseStatus = 'not_activated';
            let daysLeft = 0;
            if (lic.code) {
                if (lic.revoked) licenseStatus = 'revoked';
                else if (lic.expiresAt && new Date() > new Date(lic.expiresAt)) licenseStatus = 'expired';
                else {
                    licenseStatus = 'active';
                    daysLeft = Math.max(0, Math.ceil((new Date(lic.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
                }
            }

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
                stats: guildData?.stats || { totalTickets: 0, openTickets: 0, closedTickets: 0 },
                license: {
                    code: lic.code || null,
                    status: licenseStatus,
                    daysLeft,
                    expiresAt: lic.expiresAt || null
                }
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
        if (!req.user && !req.session.user) {
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

// === TICKET CATEGORIES ===

// Get categories for a guild
router.get('/guilds/:guildId/categories', async (req, res) => {
    try {
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }
        res.json({
            success: true,
            data: guild.ticketCategories || []
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset categories to defaults (only if guild has none)
router.post('/guilds/:guildId/categories/reset', async (req, res) => {
    try {
        const config = require('../../config/settings');
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }
        guild.ticketCategories = config.defaultCategories;
        await guild.save();
        res.json({ success: true, data: guild.ticketCategories });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a new category
router.post('/guilds/:guildId/categories', async (req, res) => {
    try {
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }
        const { id, name, emoji, description, requiredRoleId, adminOnly, enabled, panelStyle } = req.body;
        if (!id || !name) {
            return res.status(400).json({ success: false, error: 'id and name are required' });
        }
        if (guild.ticketCategories.some(c => c.id === id)) {
            return res.status(400).json({ success: false, error: 'Category id already exists' });
        }
        guild.ticketCategories.push({
            id,
            name,
            emoji: emoji || '🎫',
            description: description || '',
            requiredRoleId: requiredRoleId || null,
            adminOnly: adminOnly || false,
            enabled: enabled !== false,
            panelStyle: panelStyle || 'Primary'
        });
        await guild.save();
        res.json({ success: true, data: guild.ticketCategories });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update a category
router.put('/guilds/:guildId/categories/:catId', async (req, res) => {
    try {
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }
        const cat = guild.ticketCategories.find(c => c.id === req.params.catId);
        if (!cat) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        const allowed = ['name', 'emoji', 'description', 'requiredRoleId', 'adminOnly', 'enabled', 'panelStyle'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) cat[key] = req.body[key];
        }
        await guild.save();
        res.json({ success: true, data: guild.ticketCategories });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a category
router.delete('/guilds/:guildId/categories/:catId', async (req, res) => {
    try {
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }
        guild.ticketCategories = guild.ticketCategories.filter(c => c.id !== req.params.catId);
        await guild.save();
        res.json({ success: true, data: guild.ticketCategories });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle category (enable/disable)
router.post('/guilds/:guildId/categories/:catId/toggle', async (req, res) => {
    try {
        const guild = await Guild.findOne({ guildId: req.params.guildId });
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }
        const cat = guild.ticketCategories.find(c => c.id === req.params.catId);
        if (!cat) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        cat.enabled = !cat.enabled;
        await guild.save();
        res.json({ success: true, data: guild.ticketCategories });
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

// Force refresh guild data from Discord (emojis, channels, members) - sync
router.post('/guilds/:guildId/sync', async (req, res) => {
    try {
        const client = req.app.locals.client;
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not connected' });
        }

        const { guildId } = req.params;
        const botGuild = client.guilds.cache.get(guildId);
        if (!botGuild) {
            return res.status(404).json({ success: false, error: 'البوت ليس في هذا السيرفر' });
        }

        // Force re-fetch emojis from Discord API (clears cache first)
        await botGuild.emojis.fetch();
        // Force re-fetch channels
        await botGuild.channels.fetch();
        // Force re-fetch members (for role detection)
        await botGuild.members.fetch().catch(() => {});

        const emojis = botGuild.emojis.cache.map(e => ({
            id: e.id,
            name: e.name,
            animated: e.animated,
            url: e.imageURL({ size: 64 }),
            identifier: e.identifier,
            formatted: e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`
        })).sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            success: true,
            message: 'تمت المزامنة بنجاح',
            data: {
                emojiCount: emojis.length,
                channelCount: botGuild.channels.cache.size,
                memberCount: botGuild.memberCount,
                emojis
            }
        });
    } catch (error) {
        console.error('Sync error:', error);
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

        // Upload to Discord (keep the message - Discord CDN URLs are valid as long as the message exists)
        const msg = await uploadChannel.send({
            content: '🔒 صورة لوحة ALQUEEN - مخزنة لأغراض اللوحة',
            files: [{ attachment: buffer, name: `panel-${type || 'image'}-${Date.now()}.${ext}` }]
        });

        // Get the URL — Discord CDN URLs require the message to remain
        const attachment = msg.attachments.first();
        const url = attachment?.url;

        if (!url) {
            return res.status(500).json({ success: false, error: 'فشل رفع الصورة' });
        }

        // Track this image-storage message so we don't lose it
        await Guild.updateOne(
            { guildId },
            { $push: { panelImageMessages: msg.id } }
        ).catch(err => console.error('Track image msg error:', err.message));

        res.json({ success: true, url: url, messageId: msg.id });
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
            // Attach image file if Discord CDN URL — guarantees it shows in embed
            let files = null;
            if (newPanelSettings?.image) {
                const imgUrl = String(newPanelSettings.image).trim();
                if (imgUrl.includes('cdn.discordapp.com') || imgUrl.includes('media.discordapp.net')) {
                    try {
                        const response = await fetch(imgUrl);
                        if (response.ok) {
                            const buffer = Buffer.from(await response.arrayBuffer());
                            const ext = imgUrl.includes('.gif') ? 'gif'
                                : imgUrl.includes('.png') ? 'png'
                                : imgUrl.includes('.webp') ? 'webp'
                                : 'jpg';
                            files = [{ attachment: buffer, name: `panel-image.${ext}` }];
                            embed.setImage(`attachment://panel-image.${ext}`);
                        }
                    } catch (e) {
                        console.error('Failed to attach panel image on sendNew:', e.message);
                    }
                }
            }
            const sendPayload = files ? { embeds: [embed], components: rows, files } : { embeds: [embed], components: rows };
            const msg = await channel.send(sendPayload);
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

        // Also include all server roles (deduplicated)
        const allRoles = guild.roles.cache
            .filter(r => !r.managed && r.name !== '@everyone')
            .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
            .sort((a, b) => b.position - a.position);

        res.json({ success: true, data: memberList, roles: allRoles });
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
            userId: (req.user || req.session.user)?.id,
            userTag: (req.user || req.session.user)?.tag,
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

// =================== LICENSE MANAGEMENT (Owner only) ===================

// Check if current user is the bot owner
function checkOwner(req, res) {
    const ownerIds = licenseService.getOwnerIds();
    const userId = req.user?.id || req.session?.user?.id;
    if (!userId || !ownerIds.includes(String(userId))) {
        res.status(403).json({ success: false, error: 'هذا الإجراء متاح لمالك البوت فقط' });
        return false;
    }
    return true;
}

// Get all licenses (active, used, available)
router.get('/licenses', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const licenses = await License.find().sort({ createdAt: -1 }).lean();
        res.json({ success: true, data: licenses });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new license
router.post('/licenses', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const { durationDays = 30, note = '' } = req.body;
        const license = await licenseService.createLicense(durationDays, note, (req.user || req.session.user).id);
        res.json({
            success: true,
            data: {
                code: license.code,
                durationDays: license.durationDays,
                note: license.note,
                createdAt: license.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Disable a license (mark inactive so it can't be used)
router.post('/licenses/:code/disable', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const code = req.params.code.toUpperCase();
        const lic = await License.findOne({ code });
        if (!lic) return res.status(404).json({ success: false, error: 'الكود غير موجود' });
        if (lic.usedBy?.guildId) {
            return res.status(400).json({ success: false, error: 'لا يمكن تعطيل كود مُستخدم - استخدم /revokelicense بدلاً من ذلك' });
        }
        lic.isActive = false;
        await lic.save();
        res.json({ success: true, message: 'تم تعطيل الكود' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reactivate a license
router.post('/licenses/:code/enable', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const code = req.params.code.toUpperCase();
        const lic = await License.findOne({ code });
        if (!lic) return res.status(404).json({ success: false, error: 'الكود غير موجود' });
        if (lic.usedBy?.guildId) {
            return res.status(400).json({ success: false, error: 'لا يمكن إعادة تفعيل كود مُستخدم' });
        }
        lic.isActive = true;
        await lic.save();
        res.json({ success: true, message: 'تم تفعيل الكود' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a license (only if unused)
router.delete('/licenses/:code', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const code = req.params.code.toUpperCase();
        const lic = await License.findOne({ code });
        if (!lic) return res.status(404).json({ success: false, error: 'الكود غير موجود' });
        if (lic.usedBy?.guildId) {
            return res.status(400).json({ success: false, error: 'لا يمكن حذف كود مُستخدم' });
        }
        await License.deleteOne({ code });
        res.json({ success: true, message: 'تم حذف الكود' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all guilds with their license status
router.get('/licenses/guilds', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const guilds = await Guild.find().lean();
        const enriched = guilds.map(g => {
            const lic = g.license || {};
            let status = 'not_activated';
            if (lic.code) {
                if (lic.revoked) status = 'revoked';
                else if (lic.expiresAt && new Date() > new Date(lic.expiresAt)) status = 'expired';
                else status = 'active';
            }
            return {
                guildId: g.guildId,
                name: g.name,
                icon: g.icon,
                ownerId: g.ownerId,
                status,
                license: lic,
                daysLeft: lic.expiresAt
                    ? Math.max(0, Math.ceil((new Date(lic.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
                    : 0
            };
        });
        res.json({ success: true, data: enriched });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Revoke a guild's license
router.post('/licenses/guilds/:guildId/revoke', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const result = await licenseService.revokeGuild(req.params.guildId);
        if (!result.success) return res.status(404).json(result);
        res.json({ success: true, message: 'تم إيقاف السيرفر' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Unrevoke a guild's license
router.post('/licenses/guilds/:guildId/unrevoke', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const result = await licenseService.unrevokeGuild(req.params.guildId);
        if (!result.success) return res.status(404).json(result);
        res.json({ success: true, message: 'تم إعادة تفعيل السيرفر' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset (delete) a guild's license
router.delete('/licenses/guilds/:guildId', async (req, res) => {
    if (!checkOwner(req, res)) return;
    try {
        const result = await licenseService.deleteGuild(req.params.guildId);
        if (!result.success) return res.status(404).json(result);
        res.json({ success: true, message: 'تم مسح التفعيل من السيرفر' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
