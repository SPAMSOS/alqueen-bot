const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../../config/settings');
const Guild = require('../../database/models/Guild');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');

async function handleButton(interaction, client) {
    const { customId } = interaction;

    // Ticket creation buttons
    if (customId.startsWith('ticket_') && !['ticket_close', 'ticket_reopen', 'ticket_delete', 'ticket_transcript', 'ticket_claim', 'ticket_rate'].includes(customId)) {
        return handleTicketCreation(interaction, client, customId);
    }

    // Close ticket
    if (customId === 'ticket_close') {
        return handleTicketClose(interaction, client);
    }

    // Reopen ticket
    if (customId === 'ticket_reopen') {
        return handleTicketReopen(interaction, client);
    }

    // Delete ticket
    if (customId === 'ticket_delete') {
        return handleTicketDelete(interaction, client);
    }

    // Transcript
    if (customId === 'ticket_transcript') {
        return handleTranscript(interaction, client);
    }

    // Claim ticket
    if (customId === 'ticket_claim') {
        return handleClaim(interaction, client);
    }

    // Rating
    if (customId.startsWith('ticket_rate_')) {
        return handleRating(interaction, client, customId);
    }
}

async function handleTicketCreation(interaction, client, customId) {
    // Extract category id from customId: e.g. "ticket_support" -> "support"
    const categoryId = customId.replace(/^ticket_/, '');

    // Look up the category from guild settings OR config defaults
    let category = null;
    let guild = null;
    try {
        guild = await Guild.findOne({ guildId: interaction.guildId }).maxTimeMS(3000);
    } catch (e) {}

    // 1) Try guild.ticketCategories (new system)
    if (guild?.ticketCategories?.length) {
        const found = guild.ticketCategories.find(c => c.id === categoryId && c.enabled);
        if (found) {
            category = {
                id: found.id,
                name: found.name,
                emoji: found.emoji || '🎫',
                label: found.name,
                adminOnly: found.adminOnly || false,
                requiredRoleId: found.requiredRoleId || null
            };
        }
    }

    // 2) Try legacy panelSettings.buttons
    if (!category && guild?.panelSettings?.buttons?.length) {
        const btn = guild.panelSettings.buttons.find(b => b.id === customId);
        if (btn) {
            category = {
                id: categoryId,
                name: categoryId,
                emoji: btn.emoji || '🎫',
                label: (btn.label || 'تكت').replace(/^[^\w]+/, '').trim() || 'تكت',
                adminOnly: false,
                requiredRoleId: null
            };
        }
    }

    // 3) Fallback to config defaults
    if (!category) {
        const fromConfig = config.defaultCategories.find(c => c.id === categoryId);
        if (fromConfig) {
            category = { ...fromConfig, label: fromConfig.name };
        }
    }

    // 4) Legacy fallback
    if (!category) {
        const categoryMap = {
            'purchase': { id: 'purchase', name: 'purchase', emoji: '🛒', label: 'مشاكل الشراء' },
            'technical': { id: 'technical', name: 'technical', emoji: '🔧', label: 'مشاكل تقنية' },
            'suggestion': { id: 'suggestion', name: 'suggestion', emoji: '💡', label: 'اقتراح' },
            'other': { id: 'other', name: 'other', emoji: '💬', label: 'أخرى' }
        };
        category = categoryMap[categoryId];
    }

    if (!category) return;

    // Check if user already has an open ticket
    const existingTicket = await Ticket.findOne({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        status: { $in: ['open', 'pending'] }
    });

    if (existingTicket) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.warning)
                    .setTitle('⚠️ لديك تكت مفتوح')
                    .setDescription(`لديك تكت مفتوح بالفعل في: <#${existingTicket.channelId}>`)
            ],
            ephemeral: true
        });
    }

    // Show modal for subject (pass categoryId in customId)
    const modal = new ModalBuilder()
        .setCustomId(`modal_subject_${category.id}`)
        .setTitle(`تكت جديد - ${category.label}`);

    const subjectInput = new TextInputBuilder()
        .setCustomId('subject')
        .setLabel('عنوان التكت')
        .setPlaceholder('اكتب عنوان مختصر لمشكلتك...')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(100)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('وصف المشكلة')
        .setPlaceholder('اشرح مشكلتك بالتفصيل...')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(10)
        .setMaxLength(1000)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descriptionInput)
    );

    await interaction.showModal(modal);
}

async function handleTicketClose(interaction, client) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ التكت غير موجود')
            ],
            ephemeral: true
        });
    }

    // Show close modal
    const modal = new ModalBuilder()
        .setCustomId('modal_close_ticket')
        .setTitle('إغلاق التكت');

    const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('سبب الإغلاق')
        .setPlaceholder('اكتب سبب إغلاق التكت...')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(0)
        .setMaxLength(500)
        .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
}

async function handleTicketReopen(interaction, client) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ التكت غير موجود')
            ],
            ephemeral: true
        });
    }

    try {
        ticket.status = 'open';
        ticket.closedAt = null;
        ticket.closedBy = null;
        await ticket.save();

        await interaction.channel.permissionOverwrites.edit(ticket.userId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        await interaction.channel.setName(interaction.channel.name.replace('closed-', ''));

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('🔓 تم إعادة فتح التكت')
                    .setDescription(`تم إعادة فتح التكت بواسطة ${interaction.user}`)
            ]
        });

        await TicketLog.create({
            guildId: interaction.guildId,
            ticketId: ticket.ticketId,
            action: 'reopened',
            performedBy: {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                type: 'staff'
            }
        });

    } catch (error) {
        console.error('Reopen error:', error);
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ حدث خطأ')
            ]
        });
    }
}

async function handleTicketDelete(interaction, client) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ التكت غير موجود')
            ],
            ephemeral: true
        });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('⛔ لا تملك الصلاحية')
            ],
            ephemeral: true
        });
    }

    try {
        // Generate transcript before deletion
        const guild = await Guild.findOne({ guildId: interaction.guildId });
        if (guild?.settings?.transcriptChannelId) {
            const transcript = await generateTranscript(interaction.channel);
            const transcriptChannel = await client.channels.fetch(guild.settings.transcriptChannelId);
            if (transcriptChannel) {
                await transcriptChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.info)
                            .setTitle(`📝 نسخة من تكت #${ticket.ticketId}`)
                            .setDescription(transcript.substring(0, 4000))
                    ],
                    files: [{
                        attachment: Buffer.from(transcript, 'utf-8'),
                        name: `transcript-${ticket.ticketId}.txt`
                    }]
                });
            }
        }

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('🗑️ جاري حذف التكت...')
                    .setDescription('سيتم حذف القناة خلال 5 ثوان.')
            ]
        });

        setTimeout(async () => {
            await interaction.channel.delete();
            await Ticket.deleteOne({ channelId: interaction.channel.id });
        }, 5000);

    } catch (error) {
        console.error('Delete error:', error);
    }
}

async function handleTranscript(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const transcript = await generateTranscript(interaction.channel);

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.info)
                    .setTitle('📝 نسخة من المحادثة')
                    .setDescription('تم إنشاء نسخة من المحادثة في الأسفل.')
            ],
            files: [{
                attachment: Buffer.from(transcript, 'utf-8'),
                name: `transcript-${Date.now()}.txt`
            }]
        });
    } catch (error) {
        console.error('Transcript error:', error);
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ حدث خطأ')
            ]
        });
    }
}

async function handleClaim(interaction, client) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ التكت غير موجود')
            ],
            ephemeral: true
        });
    }

    try {
        ticket.assignedTo = {
            userId: interaction.user.id,
            userTag: interaction.user.tag
        };
        await ticket.save();

        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('✋ تم تولي التكت')
                    .setDescription(`تم تولي التكت بواسطة ${interaction.user}`)
            ]
        });

        await TicketLog.create({
            guildId: interaction.guildId,
            ticketId: ticket.ticketId,
            action: 'assigned',
            performedBy: {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                type: 'staff'
            }
        });

    } catch (error) {
        console.error('Claim error:', error);
    }
}

async function handleRating(interaction, client, customId) {
    const rating = parseInt(customId.split('_')[2]);

    try {
        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
        if (ticket) {
            ticket.rating = rating;
            await ticket.save();

            await TicketLog.create({
                guildId: interaction.guildId,
                ticketId: ticket.ticketId,
                action: 'rating_given',
                performedBy: {
                    userId: interaction.user.id,
                    userTag: interaction.user.tag
                },
                details: { rating }
            });
        }

        const stars = '⭐'.repeat(rating);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.premium)
                    .setTitle('شكراً لتقييمك! 🌟')
                    .setDescription(`لقد قيمت التكت بـ ${stars}\n\nنقدّر وقتك وملاحظاتك!`)
            ]
        });

    } catch (error) {
        console.error('Rating error:', error);
    }
}

async function generateTranscript(channel) {
    let transcript = `نسخة من قناة: #${channel.name}\n`;
    transcript += `التاريخ: ${new Date().toLocaleString('ar-SA')}\n`;
    transcript += `${'='.repeat(60)}\n\n`;

    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        for (const message of sorted.values()) {
            const timestamp = message.createdAt.toLocaleString('ar-SA');
            const author = `${message.author.tag} (${message.author.id})`;
            const content = message.content || '[مرفق/إيمبد]';
            transcript += `[${timestamp}] ${author}: ${content}\n`;
        }
    } catch (error) {
        transcript += `\n[خطأ في جلب الرسائل: ${error.message}]\n`;
    }

    return transcript;
}

module.exports = { handleButton };
