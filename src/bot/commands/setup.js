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

            // حفظ في قاعدة البيانات
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
            ).catch(err => console.error('DB:', err.message));

            // Embed احترافي مع صورة متحركة
            const panelEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({
                    name: interaction.guild.name,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTitle('🎫 ˗ˏˋ نظام التكتات الاحترافي ´ˎ˗')
                .setDescription(`
╔═══════════════════════════════╗
║  **مرحباً بك في الدعم الفني**  ║
╚═══════════════════════════════╝

> 🎫 **اختر نوع طلبك من الأزرار بالأسفل**

╭─**📋 الفئات المتاحة**─╮
│ 🛒 مشاكل الشراء
│ 🔧 مشاكل تقنية
│ 💡 اقتراحات
│ 💬 استفسار آخر
╰────────────────────╯

> ⚡ **سرعة الرد:** خلال 24 ساعة
> 👥 **فريق الدعم:** متاح 24/7
> 🔒 **الخصوصية:** محمية 100%
                `)
                .setThumbnail('https://cdn.discordapp.com/attachments/1234/ticket-icon.gif')
                .setImage('https://i.imgur.com/removed.gif')
                .setFooter({
                    text: '✨ ALQUEEN Ticket System ✨',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_purchase')
                        .setLabel('🛒 شراء')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🛒'),
                    new ButtonBuilder()
                        .setCustomId('ticket_technical')
                        .setLabel('🔧 تقنية')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔧'),
                    new ButtonBuilder()
                        .setCustomId('ticket_suggestion')
                        .setLabel('💡 اقتراح')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('💡'),
                    new ButtonBuilder()
                        .setCustomId('ticket_other')
                        .setLabel('💬 أخرى')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('💬')
                );

            // إرسال اللوحة مع منشن للدور
            const mentionRole = supportRole ? `<@&${supportRole.id}>` : '';
            await panelChannel.send({
                content: `## ✨ نظام التكتات ✨\n${mentionRole}`,
                embeds: [panelEmbed],
                components: [row]
            });

            // رسالة نجاح
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('✅ تم الإعداد بنجاح!')
                        .setDescription(`
╭─**🎉 تم إنشاء النظام بالكامل**─╮
│
│ 📁 القسم: \`${category.name}\`
│ 📝 الترانسكريبت: \`${transcriptChannel.name}\`
│ 📊 السجلات: \`${logChannel.name}\`
│ 🎫 اللوحة: \`${panelChannel.name}\`
${supportRole ? `│ 🎧 الدعم: \`${supportRole.name}\`` : ''}
│
╰────────────────────────────╯

**🌐 لوحة التحكم:**
> [alqueen-bot.onrender.com](https://alqueen-bot.onrender.com)
                        `)
                        .setFooter({ text: 'ALQUEEN Ticket System' })
                ]
            });

            // إرسال Embed في قناة السجلات
            const setupLog = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🔧 تم إعداد النظام')
                .addFields(
                    { name: '👤 المسؤول', value: interaction.user.tag, inline: true },
                    { name: '📍 السيرفر', value: interaction.guild.name, inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [setupLog] });

        } catch (error) {
            console.error('Setup error:', error.message);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('❌ خطأ')
                        .setDescription(`\`${error.message}\``)
                ]
            });
        }
    }
};
