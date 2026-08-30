const { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/settings');
const Guild = require('../../database/models/Guild');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');

async function handleModal(interaction, client) {
    const { customId } = interaction;

    if (customId.startsWith('modal_subject_')) {
        return handleSubjectModal(interaction, client, customId);
    }

    if (customId === 'modal_close_ticket') {
        return handleCloseModal(interaction, client);
    }
}

async function handleSubjectModal(interaction, client, customId) {
    const category = customId.replace('modal_subject_', '');
    const subject = interaction.fields.getTextInputValue('subject');
    const description = interaction.fields.getTextInputValue('description');

    const categoryMap = {
        'purchase': { name: 'مشاكل الشراء', emoji: '🛒', color: config.colors.primary },
        'technical': { name: 'مشاكل تقنية', emoji: '🔧', color: config.colors.info },
        'suggestion': { name: 'اقتراح', emoji: '💡', color: config.colors.success },
        'other': { name: 'أخرى', emoji: '💬', color: config.colors.warning }
    };

    const categoryData = categoryMap[category] || categoryMap.other;

    await interaction.deferReply({ ephemeral: true });

    try {
        // Get guild settings
        const guildData = await Guild.findOne({ guildId: interaction.guildId });
        const parentCategory = guildData?.settings?.ticketCategoryId;

        // Create ticket channel
        const ticketNumber = Math.floor(1000 + Math.random() * 9000);
        const channelName = `ticket-${ticketNumber}`;

        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parentCategory,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.AttachFiles
                    ]
                }
            ]
        });

        // Save ticket to database (non-blocking)
        const ticket = new Ticket({
            ticketId: `T-${ticketNumber}`,
            guildId: interaction.guildId,
            channelId: channel.id,
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            category: {
                id: category,
                name: categoryData.name,
                emoji: categoryData.emoji
            },
            subject: subject,
            description: description,
            status: 'open',
            priority: 'normal',
            customFields: {
                subject,
                description
            }
        });

        ticket.save().catch(err => console.error('Ticket save:', err.message));

        // Update guild stats (non-blocking)
        if (guildData) {
            guildData.stats.totalTickets += 1;
            guildData.stats.openTickets += 1;
            guildData.save().catch(err => console.error('Guild save:', err.message));
        }

        // Create welcome embed - styled like the example image
        const welcomeEmbed = new EmbedBuilder()
            .setColor(categoryData.color)
            .setTitle('اهلا')
            .setDescription(`
**مرحباً بك في الدعم**

يرجى اختيار نوع التذكرة

━━━━━━━━━━━━━━━━━━━━━━━━
**الموضوع:** ${subject}

**الوصف:**
${description}

**معلومات التكت:**
> 🆔 رقم التكت: \`T-${ticketNumber}\`
> 👤 أنشأ بواسطة: ${interaction.user}
> 📅 التاريخ: <t:${Math.floor(Date.now() / 1000)}:F>
> 🎯 الفئة: ${categoryData.name}

سيتم الرد عليك من قبل فريق الدعم قريباً. كن صبوراً! ⏳
            `)
            .setFooter({ text: 'ALQUEEN Ticket System' })
            .setTimestamp();

        // Use panel banner image if set
        if (guildData?.panelSettings?.image) {
            welcomeEmbed.setImage(guildData.panelSettings.image);
        }
        if (guildData?.panelSettings?.thumbnail) {
            welcomeEmbed.setThumbnail(guildData.panelSettings.thumbnail);
        }

        // Action buttons
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('🔒 إغلاق التكت')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_claim')
                    .setLabel('✋ تولي التكت')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket_transcript')
                    .setLabel('📝 نسخة')
                    .setStyle(ButtonStyle.Secondary)
            );

        const supportRole = interaction.guild.roles.cache.find(r =>
            r.name.toLowerCase().includes('support') ||
            r.name.includes('دعم') ||
            r.name.includes('الدعم')
        );

        await channel.send({
            content: `${interaction.user}${supportRole ? ` | <@&${supportRole.id}>` : ''}`,
            embeds: [welcomeEmbed],
            components: [buttons]
        });

        // Log
        await TicketLog.create({
            guildId: interaction.guildId,
            ticketId: ticket.ticketId,
            action: 'created',
            performedBy: {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                type: 'user'
            },
            details: { category, subject }
        });

        // Send log to log channel
        if (guildData?.settings?.logChannelId) {
            const logChannel = await client.channels.fetch(guildData.settings.logChannelId);
            if (logChannel) {
                await logChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.success)
                            .setTitle('📥 تكت جديد')
                            .addFields(
                                { name: 'العضو', value: interaction.user.tag, inline: true },
                                { name: 'رقم التكت', value: `T-${ticketNumber}`, inline: true },
                                { name: 'الفئة', value: categoryData.name, inline: true },
                                { name: 'الموضوع', value: subject, inline: false }
                            )
                            .setTimestamp()
                    ]
                });
            }
        }

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('✅ تم إنشاء التكت')
                    .setDescription(`تم إنشاء تكتك بنجاح في ${channel}\n\nسيتم الرد عليك في أقرب وقت ممكن.`)
            ]
        });

        // Notify dashboard
        if (client.dashboardIO) {
            client.dashboardIO.to(`guild:${interaction.guildId}`).emit('ticketCreated', {
                ticketId: ticket.ticketId,
                user: interaction.user.tag,
                subject,
                timestamp: new Date()
            });
        }

    } catch (error) {
        console.error('Create ticket error:', error);
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ حدث خطأ')
                    .setDescription('حدث خطأ أثناء إنشاء التكت. تأكد من صلاحيات البوت.')
            ]
        });
    }
}

async function handleCloseModal(interaction, client) {
    const reason = interaction.fields.getTextInputValue('reason') || 'بدون سبب';

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
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        ticket.closedBy = {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            reason: reason,
            at: new Date()
        };
        await ticket.save();

        // Update guild stats
        const guildData = await Guild.findOne({ guildId: interaction.guildId });
        if (guildData) {
            guildData.stats.openTickets = Math.max(0, guildData.stats.openTickets - 1);
            guildData.stats.closedTickets += 1;
            await guildData.save();
        }

        // Create close embed
        const closeEmbed = new EmbedBuilder()
            .setColor(config.colors.danger)
            .setTitle('🔒 تم إغلاق التكت')
            .setDescription(`
**التكت تم إغلاقه**

> 👤 بواسطة: ${interaction.user}
> 📝 السبب: ${reason}
> 📅 التاريخ: <t:${Math.floor(Date.now() / 1000)}:F>
            `)
            .setTimestamp();

        // Rating buttons
        const ratingRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_rate_1')
                    .setLabel('⭐')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_rate_2')
                    .setLabel('⭐⭐')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_rate_3')
                    .setLabel('⭐⭐⭐')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_rate_4')
                    .setLabel('⭐⭐⭐⭐')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_rate_5')
                    .setLabel('⭐⭐⭐⭐⭐')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Reopen/Delete buttons
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_reopen')
                    .setLabel('🔓 إعادة فتح')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('ticket_transcript')
                    .setLabel('📝 نسخة')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_delete')
                    .setLabel('🗑️ حذف')
                    .setStyle(ButtonStyle.Danger)
            );

        // Remove user access
        await interaction.channel.permissionOverwrites.delete(ticket.userId);

        // Rename channel
        try {
            await interaction.channel.setName(`closed-${ticket.ticketId}`);
        } catch (e) {}

        await interaction.channel.send({
            embeds: [closeEmbed],
            components: [ratingRow, actionRow]
        });

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('✅ تم إغلاق التكت')
                    .setDescription('شكراً لتواصلك معنا! 🌟')
            ],
            ephemeral: true
        });

        await TicketLog.create({
            guildId: interaction.guildId,
            ticketId: ticket.ticketId,
            action: 'closed',
            performedBy: {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                type: 'staff'
            },
            details: { reason }
        });

    } catch (error) {
        console.error('Close error:', error);
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ حدث خطأ')
            ]
        });
    }
}

module.exports = { handleModal };
