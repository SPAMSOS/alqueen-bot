const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Guild = require('../../database/models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('إعادة إرسال لوحة التكتات')
        .setDescriptionLocalizations({
            'en-US': 'Resend the ticket panel'
        }),

    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('⛔ لا تملك الصلاحية')
                        .setDescription('هذا الأمر يتطلب صلاحية **مدير**.')
                ],
                ephemeral: true
            });
        }

        const guild = await Guild.findOne({ guildId: interaction.guild.id });
        if (!guild) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.warning)
                        .setTitle('⚠️ لم يتم الإعداد')
                        .setDescription('لم يتم إعداد نظام التكتات بعد. استخدم `/setup` أولاً.')
                ],
                ephemeral: true
            });
        }

        const panelChannel = await client.channels.fetch(interaction.channelId);

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

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('✅ تم إرسال اللوحة')
                    .setDescription(`تم إرسال لوحة التكتات في ${interaction.channel.toString()}`)
            ],
            ephemeral: true
        });

        await panelChannel.send({ embeds: [panelEmbed], components: [row] });
    }
};
