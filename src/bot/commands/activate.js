const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { activateLicense, checkLicense } = require('../utils/licenseService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('activate')
        .setDescription('🔑 تفعيل البوت بكود التفعيل')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('كود التفعيل (مثال: ALQ-XXXX-XXXX-XXXX)')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const code = interaction.options.getString('code');

        // Check current status
        const current = await checkLicense(interaction.guildId);
        if (current.valid) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('✅ البوت مفعل بالفعل')
                        .setDescription(`الكود: \`${current.code}\`\nصالح حتى: <t:${Math.floor(new Date(current.expiresAt).getTime() / 1000)}:F>`)
                ]
            });
        }

        const result = await activateLicense(interaction.guildId, code);

        if (!result.success) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('❌ فشل التفعيل')
                        .setDescription(result.error)
                ]
            });
        }

        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🎉 تم تفعيل البوت بنجاح!')
                    .setDescription(`
✅ **تم تفعيل ALQUEEN في سيرفرك**

> 🔑 الكود: \`${result.code}\`
> ⏰ المدة: ${result.durationDays} يوم
> 📅 ينتهي في: <t:${Math.floor(new Date(result.expiresAt).getTime() / 1000)}:F>
> 📆 <t:${Math.floor(new Date(result.expiresAt).getTime() / 1000)}:R>

شغّل \`/setup\` الآن لبدء إعداد نظام التكتات!
                    `)
                    .setFooter({ text: 'ALQUEEN Ticket System' })
                    .setTimestamp()
            ]
        });
    }
};
