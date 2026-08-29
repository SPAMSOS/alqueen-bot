const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Guild = require('../../database/models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('🎫 إعداد نظام التكتات الاحترافي في سيرفرك')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('اسم قسم التكتات')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('⛔ لا تملك الصلاحية')
                        .setDescription('تحتاج صلاحية **Administrator**')
                ],
                ephemeral: true
            });
        }

        const categoryName = interaction.options.getString('name') || 'Tickets';

        await interaction.deferReply({ ephemeral: true });

        try {
            // ✅ التحقق من وجود نظام مسبقاً
            const existingGuild = await Guild.findOne({ guildId: interaction.guild.id });

            if (existingGuild && existingGuild.settings?.ticketCategoryId) {
                // التحقق من أن القنوات لا تزال موجودة
                const existingCategory = interaction.guild.channels.cache.get(existingGuild.settings.ticketCategoryId);
                const existingPanel = existingGuild.settings.panelChannelId
                    ? interaction.guild.channels.cache.get(existingGuild.settings.panelChannelId)
                    : null;

                if (existingCategory && existingPanel) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFEE75C)
                                .setTitle('⚠️ النظام مُعد مسبقاً!')
                                .setDescription(`
╭─**📋 النظام موجود بالفعل**─╮
│
│ 📁 القسم: ${existingCategory}
│ 🎫 اللوحة: ${existingPanel}
│ 📊 السجلات: ${existingGuild.settings.logChannelId ? `<#${existingGuild.settings.logChannelId}>` : '❌ محذوفة'}
│
╰───────────────────────────╯

**💡 الخيارات المتاحة:**
> 🔄 استخدم \`/panel\` لإعادة إرسال اللوحة
> 🗑️ احذف القسم يدوياً ثم أعد \`/setup\`
                                `)
                                .setFooter({ text: 'ALQUEEN Ticket System' })
                        ]
                    });
                }
            }

            // إنشاء القسم
            const category = await interaction.guild.channels.create({
                name: `🎫・${categoryName}`,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });

            // القنوات
            const transcriptChannel = await interaction.guild.channels.create({
                name: '📝・transcripts',
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] }
                ]
            });

            const logChannel = await interaction.guild.channels.create({
                name: '📊・logs',
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] }
                ]
            });

            const panelChannel = await interaction.guild.channels.create({
                name: '🎫・create-ticket',
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
                    }
                ]
            });

            // رول الدعم
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

            if (supportRole) {
                try {
                    await category.permissionOverwrites.create(supportRole, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        ManageMessages: true
                    });
                } catch (e) {}
            }

            // حفظ في قاعدة البيانات (بدون انتظار)
            Guild.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    name: interaction.guild.name,
                    ownerId: interaction.guild.ownerId,
                    'settings.ticketCategoryId': category.id,
                    'settings.transcriptChannelId': transcriptChannel.id,
                    'settings.logChannelId': logChannel.id,
                    'settings.panelChannelId': panelChannel.id,
                    'settings.supportRoleId': supportRole?.id
                },
                { upsert: true, new: true }
            ).catch(err => console.error('DB save error:', err.message));


            // Embed احترافي
            const panelEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({
                    name: `🎫 ${interaction.guild.name} - نظام التكتات`,
                    iconURL: interaction.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
                })
                .setTitle('✨ نظام الدعم الفني الاحترافي ✨')
                .setDescription(`
╔═══════════════════════════════════╗
║                                   ║
║   **مرحباً بك في نظام التكتات**  ║
║                                   ║
╚═══════════════════════════════════╝

> 🎫 **اختر نوع طلبك من الأزرار أدناه**

**📋 الفئات المتاحة:**
> 🛒 **مشاكل الشراء** - للإبلاغ عن مشاكل في المشتريات
> 🔧 **مشاكل تقنية** - للمشاكل الفنية والإخطاء
> 💡 **اقتراحات** - شاركنا أفكارك ومقترحاتك
> 💬 **استفسار آخر** - لأي سؤال آخر

**⚡ معلومات سريعة:**
> 🕐 سرعة الرد: خلال 24 ساعة
> 👥 فريق الدعم: متاح 24/7
> 🔒 الخصوصية: محمية 100%
> ⭐ التقييم: نسعد برأيك
                `)
                .setFooter({
                    text: '🎫 ALQUEEN Ticket System',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
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

            const mentionRole = supportRole ? `<@&${supportRole.id}>` : '';
            await panelChannel.send({
                content: `## ✨ مرحباً - اختر تكت من الأزرار\n${mentionRole}`,
                embeds: [panelEmbed],
                components: [row]
            });

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('✅ تم الإعداد بنجاح!')
                        .setDescription(`
╭─**🎉 النظام جاهز للاستخدام**─╮
│
│ 📁 القسم: \`${category.name}\`
│ 📝 الترانسكريبت: \`${transcriptChannel.name}\`
│ 📊 السجلات: \`${logChannel.name}\`
│ 🎫 اللوحة: \`${panelChannel.name}\`
${supportRole ? `│ 🎧 الدعم: \`${supportRole.name}\`` : ''}
│
╰────────────────────────────╯

**🌐 لوحة التحكم:**
> https://alqueen-bot.onrender.com
                        `)
                        .setFooter({ text: 'ALQUEEN Ticket System' })
                ]
            });

            try {
                const setupLog = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🔧 تم إعداد النظام')
                    .addFields(
                        { name: '👤 المسؤول', value: interaction.user.tag, inline: true },
                        { name: '📍 السيرفر', value: interaction.guild.name, inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [setupLog] });
            } catch (e) {}

        } catch (error) {
            console.error('Setup error:', error.message);
            try {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle('❌ خطأ')
                            .setDescription(`\`${error.message}\``)
                    ]
                });
            } catch (e) {}
        }
    }
};
