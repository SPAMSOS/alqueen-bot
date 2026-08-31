const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const config = require('../../config/settings');
const Guild = require('../../database/models/Guild');
const { sendOrUpdatePanel } = require('../utils/panelBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('إعادة إرسال/تحديث لوحة التكتات')
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('إرسال أو تحديث أو حذف')
                .setRequired(false)
                .addChoices(
                    { name: '🔄 تحديث في نفس القناة', value: 'update' },
                    { name: '📤 إرسال جديد', value: 'send' }
                )
        ),

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

        const action = interaction.options.getString('action') || 'update';

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

        const channel = await client.channels.fetch(interaction.channelId);

        try {
            const result = await sendOrUpdatePanel(
                client,
                channel,
                guild.panelSettings,
                interaction.guild.name,
                guild.ticketCategories
            );

            // Save message id for future updates
            if (result.message) {
                await Guild.updateOne(
                    { guildId: interaction.guild.id },
                    { $set: { panelMessageId: result.message.id } }
                );
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setTitle(result.action === 'updated' ? '✅ تم تحديث اللوحة' : '✅ تم إرسال اللوحة')
                        .setDescription(result.action === 'updated'
                            ? 'تم تحديث اللوحة في هذه القناة. أي تعديل في الموقع سيظهر هنا.'
                            : 'تم إرسال لوحة جديدة. سيتم تحديثها تلقائياً من الموقع.')
                ],
                ephemeral: true
            });
        } catch (e) {
            console.error('Panel error:', e);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(config.colors.danger)
                    .setTitle('❌ خطأ')
                    .setDescription(`\`${e.message}\``)],
                ephemeral: true
            });
        }
    }
};
