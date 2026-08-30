const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { revokeGuild, unrevokeGuild, isOwner } = require('../utils/licenseService');
const Guild = require('../../database/models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revokelicense')
        .setDescription('🚫 [للمالك فقط] إيقاف أو إعادة تفعيل سيرفر')
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('آيدي السيرفر')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('action')
                .setDescription('الإجراء: revoke (إيقاف) أو unrevoke (إعادة تفعيل)')
                .setRequired(true)
                .addChoices(
                    { name: '🚫 إيقاف', value: 'revoke' },
                    { name: '✅ إعادة تفعيل', value: 'unrevoke' }
                )
        ),

    async execute(interaction, client) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('⛔ للمالك فقط')
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.options.getString('guild_id');
        const action = interaction.options.getString('action');

        const guild = await Guild.findOne({ guildId });
        if (!guild) {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('❌ السيرفر غير موجود')]
            });
        }

        if (action === 'revoke') {
            await revokeGuild(guildId);
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('🚫 تم إيقاف السيرفر')
                        .setDescription(`**${guild.name}** (\`${guildId}\`)\nلن يعمل البوت في هذا السيرفر حتى إعادة التفعيل.`)
                ]
            });
        } else {
            await unrevokeGuild(guildId);
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('✅ تم إعادة التفعيل')
                        .setDescription(`**${guild.name}** (\`${guildId}\`)\nالبوت يعمل من جديد.`)
                ]
            });
        }
    }
};
