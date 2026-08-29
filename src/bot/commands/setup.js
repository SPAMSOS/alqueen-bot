const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Guild = require('../../database/models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('إعداد نظام التكتات في سيرفرك')
        .setDescriptionLocalizations({
            'en-US': 'Setup the ticket system in your server'
        })
        .addStringOption(option =>
            option.setName('name')
                .setDescription('اسم قسم التكتات (افتراضي: Tickets)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        // Check admin permissions
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
                        reason: 'ALQUEEN Ticket Bot Auto-created',
                        permissions: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ManageMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    });
                } catch (e) {
                    console.log('Cannot create role (missing permissions)');
                }
            }

            // Update category permissions with support role
            if (supportRole) {
                await category.permissionOverwrites.create(supportRole, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                await transcriptChannel.permissionOverwrites.create(supportRole, {
                    ViewChannel: true,
                    ReadMessageHistory: true
                });
                await logChannel.permissionOverwrites.create(supportRole, {
                    ViewChannel: true,
                    ReadMessageHistory: true
                });
            }

            // Save or update guild settings in database
            let guildData = await Guild.findOne({ guildId: interaction.guild.id });
            if (!guildData) {
                guildData = new Guild({
                    guildId: interaction.guild.id,
                    name: interaction.guild.name,
                    ownerId: interaction.guild.ownerId
                });
            }

            guildData.settings.ticketCategoryId = category.id;
            guildData.settings.transcriptChannelId = transcriptChannel.id;
            guildData.settings.logChannelId = logChannel.id;
            guildData.settings.supportRoleId = supportRole?.id;
            await guildData.save();

            // Create panel embed
            const panelEmbed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle('🎫 نظام التكتات')
                .setDescription(`
**مرحباً بك في نظام الدعم الفني!**

اختر نوع المشكلة التي تريد الإبلاغ عنها:

> 🛒 **مشاكل الشراء** - للإبلاغ عن مشاكل في المشتريات
> 🔧 **مشاكل تقنية** - للمشاكل الفنية والإخطاء
> 💡 **اقتراحات** - شاركنا أفكارك ومقترحاتك
> 💬 **أخرى** - لأي استفسار آخر

━━━━━━━━━━━━━━━━━━━━━━━━
📌 **معلومات مهمة:**
> • الحد الأقصى للتكتات: **5**
> • وقت الاستجابة: **خلال 24 ساعة**
> • كن مهذباً ومحترماً
━━━━━━━━━━━━━━━━━━━━━━━━
                `)
                .setFooter({ text: 'ALQUEEN Ticket System' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_purchase')
                        .setLabel('🛒 مشاكل الشراء')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('ticket_technical')
                        .setLabel('🔧 مشاكل تقنية')
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

            // Success message
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setTitle('✅ تم الإعداد بنجاح!')
                        .setDescription(`
**تم إنشاء نظام التكتات في سيرفرك:**

> 📁 قسم التكتات: ${category}
> 📝 قناة الترانسكريبت: ${transcriptChannel}
> 📊 قناة السجلات: ${logChannel}
> 🎫 قناة الإنشاء: ${panelChannel}
${supportRole ? `> 🎧 رول الدعم: ${supportRole}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━
**📌 الخطوات التالية:**
1. ✅ تم إنشاء رول Support تلقائياً (إن أمكن)
2. 🔧 تأكد من إعطاء الرول الصلاحيات اللازمة
3. 🎉 البوت جاهز للاستخدام!

**🌐 لوحة التحكم:**
> زُر موقعنا لإدارة التكتات من المتصفح
                        `)
                ]
            });

            // Log to log channel
            const setupLog = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('🔧 تم إعداد نظام التكتات')
                .addFields(
                    { name: 'المسؤول', value: interaction.user.tag, inline: true },
                    { name: 'القناة', value: panelChannel.toString(), inline: true },
                    { name: 'القسم', value: category.toString(), inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [setupLog] });

        } catch (error) {
            console.error('Setup error:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('❌ حدث خطأ')
                        .setDescription(`**الخطأ:** ${error.message}\n\n**تأكد من:**
> • البوت لديه صلاحية Administrator
> • البوت يقدر ينشأ قنوات
> • البوت يقدر ينشأ رولات`)
                ]
            });
        }
    }
};
