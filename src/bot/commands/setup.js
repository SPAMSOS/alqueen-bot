const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Guild = require('../../database/models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('إعداد نظام التكتات في سيرفرك')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('اسم قسم التكتات (افتراضي: Tickets)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('⛔ لا تملك الصلاحية')
                        .setDescription('هذا الأمر يتطلب صلاحية **Administrator**.')
                ],
                ephemeral: true
            });
        }

        const categoryName = interaction.options.getString('name') || 'Tickets';

        await interaction.deferReply({ ephemeral: true });

        try {
            // Create category
            const category = await interaction.guild.channels.create({
                name: `🎫 ${categoryName}`,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });

            // Create transcript channel
            const transcriptChannel = await interaction.guild.channels.create({
                name: '📝-transcripts',
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });

            // Create logs channel
            const logChannel = await interaction.guild.channels.create({
                name: '📊-ticket-logs',
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });

            // Create panel channel
            const panelChannel = await interaction.guild.channels.create({
                name: '🎫-create-ticket',
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
                    }
                ]
            });

            // Find or create Support role
            let supportRole = interaction.guild.roles.cache.find(r =>
                r.name.toLowerCase().includes('support') ||
                r.name.includes('دعم') ||
                r.name.includes('الدعم')
            );

            if (!supportRole) {
                try {
                    supportRole = await interaction.guild.roles.create({
                        name: '🎧 Support',
                        color: 0x5865F2,
                        reason: 'ALQUEEN Ticket Bot'
                    });
                } catch (e) {}
            }

            // Update category permissions
            if (supportRole) {
                try {
                    await category.permissionOverwrites.create(supportRole, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true
                    });
                } catch (e) {}
            }

            // Save to database (don't block)
            Guild.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    name: interaction.guild.name,
                    ownerId: interaction.guild.ownerId,
                    'settings.ticketCategoryId': category.id,
                    'settings.transcriptChannelId': transcriptChannel.id,
                    'settings.logChannelId': logChannel.id,
                    'settings.supportRoleId': supportRole?.id
                },
                { upsert: true, new: true }
            ).catch(err => console.error('DB save error:', err));

            // Create panel embed
            const panelEmbed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle('🎫 نظام التكتات')
                .setDescription(`
**مرحباً بك في نظام الدعم الفني!**

اختر نوع المشكلة:

> 🛒 **مشاكل الشراء** - للإبلاغ عن مشاكل في المشتريات
> 🔧 **مشاكل تقنية** - للمشاكل الفنية
> 💡 **اقتراحات** - شاركنا أفكارك
> 💬 **أخرى** - لأي استفسار آخر

📌 كن مهذباً ومحترماً.
                `)
                .setFooter({ text: 'ALQUEEN Ticket System' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_purchase')
                        .setLabel('🛒 شراء')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('ticket_technical')
                        .setLabel('🔧 تقنية')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('ticket_suggestion')
                        .setLabel('💡 اقتراح')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('ticket_other')
                        .setLabel('💬 أخرى')
                        .setStyle(ButtonStyle.Danger)
                );

            await panelChannel.send({ embeds: [panelEmbed], components: [row] });

            // Success - just send simple message, don't use toString() to avoid issues
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setTitle('✅ تم الإعداد بنجاح!')
                        .setDescription(`
**تم إنشاء نظام التكتات:**

> 📁 القسم: \`${category.name}\`
> 📝 الترانسكريبت: \`${transcriptChannel.name}\`
> 📊 السجلات: \`${logChannel.name}\`
> 🎫 اللوحة: \`${panelChannel.name}\`
${supportRole ? `> 🎧 رول الدعم: \`${supportRole.name}\`` : ''}

**الخطوات التالية:**
1. أعطِ رول Support الصلاحيات في القسم
2. البوت جاهز للاستخدام!
                        `)
                ]
            });

        } catch (error) {
            console.error('Setup error:', error.message);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('❌ حدث خطأ')
                        .setDescription(`**الخطأ:** ${error.message}\n\n**تأكد من:**\n• البوت Administrator\n• البوت يقدر ينشأ قنوات`)
                ]
            });
        }
    }
};
