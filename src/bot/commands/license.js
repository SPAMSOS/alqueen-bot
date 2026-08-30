const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkLicense } = require('../utils/licenseService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('license')
        .setDescription('📋 عرض حالة تفعيل البوت في هذا السيرفر'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const status = await checkLicense(interaction.guildId);

        const color = status.valid ? 0x57F287 : 0xED4245;
        const statusEmoji = status.valid ? '✅' : '❌';
        const statusText = {
            not_registered: 'السيرفر غير مسجل',
            not_activated: 'غير مفعل',
            revoked: 'معطّل من المالك',
            expired: 'منتهي الصلاحية'
        }[status.reason] || 'غير معروف';

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${statusEmoji} حالة التفعيل`)
            .addFields(
                { name: '📍 السيرفر', value: interaction.guild.name, inline: true },
                { name: '🔐 الحالة', value: statusText, inline: true }
            );

        if (status.valid) {
            embed.addFields(
                { name: '🔑 الكود', value: `\`${status.code}\``, inline: false },
                { name: '⏰ ينتهي في', value: `<t:${Math.floor(new Date(status.expiresAt).getTime() / 1000)}:F>\n<t:${Math.floor(new Date(status.expiresAt).getTime() / 1000)}:R>`, inline: false }
            );
        } else if (status.reason === 'expired' && status.expiresAt) {
            embed.addFields(
                { name: '⏰ انتهى في', value: `<t:${Math.floor(new Date(status.expiresAt).getTime() / 1000)}:F>`, inline: false }
            );
        }

        if (!status.valid) {
            embed.setDescription('تواصل مع مالك البوت للحصول على كود تفعيل جديد.\nاستخدم `/activate <code>` بعد الحصول على الكود.');
        }

        embed.setFooter({ text: 'ALQUEEN Ticket System' }).setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};
