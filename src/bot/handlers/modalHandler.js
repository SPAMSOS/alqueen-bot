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
    const categoryId = customId.replace('modal_subject_', '');
    const subject = interaction.fields.getTextInputValue('subject');
    const description = interaction.fields.getTextInputValue('description');

    // Get guild settings first so we can resolve the category
    const guildData = await Guild.findOne({ guildId: interaction.guildId }).maxTimeMS(3000);

    // Resolve category: prefer guild.ticketCategories, then config defaults, then legacy
    let categoryData = null;
    if (guildData?.ticketCategories?.length) {
        const found = guildData.ticketCategories.find(c => c.id === categoryId);
        if (found) {
            const styleColor = found.panelStyle === 'Success' ? config.colors.success
                : found.panelStyle === 'Danger' ? config.colors.danger
                : found.panelStyle === 'Secondary' ? config.colors.info
                : config.colors.primary;
            categoryData = {
                id: found.id,
                name: found.name,
                emoji: found.emoji || '🎫',
                color: styleColor,
                adminOnly: found.adminOnly || false,
                requiredRoleId: found.requiredRoleId || null
            };
        }
    }
    if (!categoryData) {
        const fromConfig = config.defaultCategories.find(c => c.id === categoryId);
        if (fromConfig) {
            const styleColor = fromConfig.panelStyle === 'Success' ? config.colors.success
                : fromConfig.panelStyle === 'Danger' ? config.colors.danger
                : fromConfig.panelStyle === 'Secondary' ? config.colors.info
                : config.colors.primary;
            categoryData = { ...fromConfig, color: styleColor };
        }
    }
    // Legacy fallback
    if (!categoryData) {
        const categoryMap = {
            'purchase': { name: 'مشاكل الشراء', emoji: '🛒', color: config.colors.primary, adminOnly: false, requiredRoleId: null },
            'technical': { name: 'مشاكل تقنية', emoji: '🔧', color: config.colors.info, adminOnly: false, requiredRoleId: null },
            'suggestion': { name: 'اقتراح', emoji: '💡', color: config.colors.success, adminOnly: false, requiredRoleId: null },
            'other': { name: 'أخرى', emoji: '💬', color: config.colors.warning, adminOnly: false, requiredRoleId: null }
        };
        categoryData = { id: categoryId, ...(categoryMap[categoryId] || categoryMap.other) };
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const parentCategory = guildData?.settings?.ticketCategoryId;

        // Create ticket channel
        const ticketNumber = Math.floor(1000 + Math.random() * 9000);
        const channelName = `ticket-${ticketNumber}`;

        // Build permission overwrites: hide from everyone, show to user + required roles
        const permissionOverwrites = [
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
        ];

        // If category has a specific required role, only that role can see (adminOnly)
        if (categoryData.requiredRoleId) {
            // Add the specific role with view
            permissionOverwrites.push({
                id: categoryData.requiredRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                ]
            });
            // If adminOnly, support role is explicitly denied
            if (categoryData.adminOnly && guildData?.settings?.supportRoleId) {
                permissionOverwrites.push({
                    id: guildData.settings.supportRoleId,
                    deny: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages
                    ]
                });
            }
        }

        // For non-adminOnly categories, support role can see
        if (!categoryData.adminOnly && !categoryData.requiredRoleId && guildData?.settings?.supportRoleId) {
            permissionOverwrites.push({
                id: guildData.settings.supportRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                ]
            });
        }

        // Admin role always sees everything
        if (guildData?.settings?.adminRoleId) {
            permissionOverwrites.push({
                id: guildData.settings.adminRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                ]
            });
        }

        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parentCategory,
            permissionOverwrites
        });

        // Save ticket to database (non-blocking)
        const ticket = new Ticket({
            ticketId: `T-${ticketNumber}`,
            guildId: interaction.guildId,
            channelId: channel.id,
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            category: {
                id: categoryData.id,
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

        // Create welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setColor(categoryData.color)
            .setTitle('اهلا')
            .setDescription(`
**مرحباً بك في الدعم**

━━━━━━━━━━━━━━━━━━━━━━━━
**الموضوع:** ${subject}

**الوصف:**
${description}

**معلومات التكت:**
> 🆔 رقم التكت: \`T-${ticketNumber}\`
> 👤 أنشأ بواسطة: ${interaction.user}
> 📅 التاريخ: <t:${Math.floor(Date.now() / 1000)}:F>
> 🎯 الفئة: ${categoryData.emoji} ${categoryData.name}

سيتم الرد عليك من قبل فريق الدعم قريباً. كن صبوراً! ⏳
            `)
            .setFooter({ text: 'ALQUEEN Ticket System' })
            .setTimestamp();

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

        // Mention: support role (for normal), or required role (for adminOnly)
        let mention = `${interaction.user}`;
        if (categoryData.adminOnly && categoryData.requiredRoleId) {
            // Admin-only category: ping the specific required role
            mention += ` | <@&${categoryData.requiredRoleId}>`;
        } else if (categoryData.requiredRoleId) {
            // Has a specific required role (not adminOnly): ping it
            mention += ` | <@&${categoryData.requiredRoleId}>`;
        } else if (guildData?.settings?.supportRoleId) {
            // No specific role: use server's default support role
            const supportRole = interaction.guild.roles.cache.get(guildData.settings.supportRoleId);
            if (supportRole) mention += ` | <@&${supportRole.id}>`;
        }

        await channel.send({
            content: mention,
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
            details: { category: categoryData.id, subject }
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
                                { name: 'الفئة', value: `${categoryData.emoji} ${categoryData.name}`, inline: true },
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
                category: categoryData,
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
