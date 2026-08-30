const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DEFAULT_BUTTONS = [
    { id: 'ticket_purchase', label: '🛒 شراء', emoji: '🛒', style: 'Primary', order: 0 },
    { id: 'ticket_technical', label: '🔧 تقنية', emoji: '🔧', style: 'Secondary', order: 1 },
    { id: 'ticket_suggestion', label: '💡 اقتراح', emoji: '💡', style: 'Success', order: 2 },
    { id: 'ticket_other', label: '💬 أخرى', emoji: '💬', style: 'Danger', order: 3 }
];

const styleMap = {
    Primary: ButtonStyle.Primary,
    Secondary: ButtonStyle.Secondary,
    Success: ButtonStyle.Success,
    Danger: ButtonStyle.Danger
};

function buildPanelEmbed(panelSettings, guildName) {
    const color = parseInt((panelSettings?.color || '5865F2').replace('#', ''), 16);
    const embed = new EmbedBuilder()
        .setColor(isNaN(color) ? 0x5865F2 : color)
        .setTitle(panelSettings?.title || '✨ نظام الدعم الفني الاحترافي ✨')
        .setDescription(panelSettings?.description || 'اختر نوع طلبك من الأزرار أدناه')
        .setFooter({ text: panelSettings?.footer || '🎫 ALQUEEN Ticket System' })
        .setTimestamp();

    if (panelSettings?.image) embed.setImage(panelSettings.image);
    if (panelSettings?.thumbnail) embed.setThumbnail(panelSettings.thumbnail);
    if (guildName) {
        embed.setAuthor({ name: `🎫 ${guildName} - نظام التكتات` });
    }

    return embed;
}

function buildPanelButtons(panelSettings) {
    const buttons = panelSettings?.buttons?.length
        ? [...panelSettings.buttons].sort((a, b) => (a.order || 0) - (b.order || 0))
        : DEFAULT_BUTTONS;

    // Discord max 5 buttons per row
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

async function sendOrUpdatePanel(client, channel, panelSettings, guildName) {
    const embed = buildPanelEmbed(panelSettings, guildName);
    const rows = buildPanelButtons(panelSettings);
    const payload = { embeds: [embed], components: rows };

    // Try to find existing panel message in channel
    if (panelSettings?.messageId) {
        try {
            const msg = await channel.messages.fetch(panelSettings.messageId);
            if (msg) {
                await msg.edit(payload);
                return { message: msg, action: 'updated' };
            }
        } catch (e) {
            // Message deleted, send new
        }
    }

    const msg = await channel.send(payload);
    return { message: msg, action: 'sent' };
}

module.exports = { buildPanelEmbed, buildPanelButtons, sendOrUpdatePanel, DEFAULT_BUTTONS };
