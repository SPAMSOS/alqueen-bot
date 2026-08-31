const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/settings');

const styleMap = {
    Primary: ButtonStyle.Primary,
    Secondary: ButtonStyle.Secondary,
    Success: ButtonStyle.Success,
    Danger: ButtonStyle.Danger
};

// Default fallback (used only if guild has no categories AND no custom buttons)
const DEFAULT_BUTTONS = [
    { id: 'ticket_support', label: '🎫 دعم فني', emoji: '🎫', style: 'Primary', order: 0 }
];

function buildPanelEmbed(panelSettings, guildName) {
    const color = parseInt((panelSettings?.color || '5865F2').replace('#', ''), 16);
    const embed = new EmbedBuilder()
        .setColor(isNaN(color) ? 0x5865F2 : color)
        .setTitle(panelSettings?.title || '✨ نظام الدعم الفني الاحترافي ✨')
        .setDescription(panelSettings?.description || 'اختر نوع طلبك من الأزرار أدناه')
        .setFooter({ text: panelSettings?.footer || '🎫 ALQUEEN Ticket System' })
        .setTimestamp();

    if (panelSettings?.image) {
        const imgUrl = String(panelSettings.image).trim();
        if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
            embed.setImage(imgUrl);
        }
    }
    if (panelSettings?.thumbnail) {
        const thumbUrl = String(panelSettings.thumbnail).trim();
        if (thumbUrl.startsWith('http://') || thumbUrl.startsWith('https://')) {
            embed.setThumbnail(thumbUrl);
        }
    }
    if (guildName) {
        embed.setAuthor({ name: `🎫 ${guildName} - نظام التكتات` });
    }

    return embed;
}

// Build buttons from CATEGORIES (new system) — each category = one button
function buildCategoryButtons(categories) {
    const enabled = (categories || []).filter(c => c.enabled);
    if (enabled.length === 0) {
        // Fall back to default categories from config
        return buildCategoryButtons(config.defaultCategories);
    }

    // Discord max 5 buttons per row, max 5 rows (25 total)
    const rows = [];
    for (let i = 0; i < enabled.length; i += 5) {
        const row = new ActionRowBuilder();
        enabled.slice(i, i + 5).forEach(cat => {
            const builder = new ButtonBuilder()
                .setCustomId(`ticket_${cat.id}`)
                .setLabel((cat.name || 'فتح تكت').slice(0, 80))
                .setStyle(styleMap[cat.panelStyle] || ButtonStyle.Primary);
            if (cat.emoji) builder.setEmoji(cat.emoji);
            row.addComponents(builder);
        });
        rows.push(row);
    }
    return rows;
}

// Legacy: build from panelSettings.buttons
function buildPanelButtons(panelSettings) {
    const buttons = panelSettings?.buttons?.length
        ? [...panelSettings.buttons].sort((a, b) => (a.order || 0) - (b.order || 0))
        : DEFAULT_BUTTONS;

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        const row = new ActionRowBuilder();
        buttons.slice(i, i + 5).forEach(btn => {
            const builder = new ButtonBuilder()
                .setCustomId(btn.id || `ticket_${i}`)
                .setLabel((btn.label || 'فتح تكت').slice(0, 80))
                .setStyle(styleMap[btn.style] || ButtonStyle.Primary);
            if (btn.emoji) builder.setEmoji(btn.emoji);
            row.addComponents(builder);
        });
        rows.push(row);
    }
    return rows;
}

async function sendOrUpdatePanel(client, channel, panelSettings, guildName, categories) {
    // Prefer categories over legacy buttons
    const useCategories = categories && categories.length > 0;
    const embed = buildPanelEmbed(panelSettings, guildName);
    const rows = useCategories
        ? buildCategoryButtons(categories)
        : buildPanelButtons(panelSettings);
    const payload = { embeds: [embed], components: rows };

    // If the image is a Discord CDN URL, attach the file
    let files = null;
    if (panelSettings?.image) {
        const imgUrl = String(panelSettings.image).trim();
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
                console.error('Failed to attach panel image:', e.message);
            }
        }
    }

    const finalPayload = files ? { ...payload, files } : payload;

    // Try to find existing panel message in channel
    if (panelSettings?.messageId) {
        try {
            const msg = await channel.messages.fetch(panelSettings.messageId);
            if (msg) {
                await msg.edit(finalPayload);
                return { message: msg, action: 'updated' };
            }
        } catch (e) {
            // Message deleted
        }
    }

    // Try to find a recent message from the bot with components
    try {
        const recent = await channel.messages.fetch({ limit: 10 });
        const botMsg = recent.find(m =>
            m.author.id === client.user.id &&
            m.components && m.components.length > 0
        );
        if (botMsg) {
            await botMsg.edit(finalPayload);
            return { message: botMsg, action: 'updated' };
        }
    } catch (e) {}

    const msg = await channel.send(finalPayload);
    return { message: msg, action: 'sent' };
}

module.exports = {
    buildPanelEmbed,
    buildPanelButtons,
    buildCategoryButtons,
    sendOrUpdatePanel,
    DEFAULT_BUTTONS
};
