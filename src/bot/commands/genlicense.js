const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createLicense, isOwner } = require('../utils/licenseService');
const License = require('../../database/models/License');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('genlicense')
        .setDescription('🔑 [للمالك فقط] إنشاء كود تفعيل جديد')
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('مدة الصلاحية بالأيام (افتراضي 30)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(3650)
        )
        .addStringOption(option =>
            option.setName('note')
                .setDescription('ملاحظة على الكود (اختياري)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('⛔ للمالك فقط')
                        .setDescription('هذا الأمر متاح لمالك البوت فقط.')
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const days = interaction.options.getInteger('days') || 30;
        const note = interaction.options.getString('note') || '';

        const license = await createLicense(days, note, interaction.user.id);

        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🔑 تم إنشاء كود تفعيل جديد')
                    .setDescription(`
\`\`\`
${license.code}
\`\`\`

> ⏰ المدة: **${days} يوم**
> 📅 ينتهي بعد التفعيل: <t:${Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60)}:R>
${note ? `> 📝 ملاحظة: ${note}` : ''}

**أرسل هذا الكود للعميل ليقوم بتفعيل البوت بـ** \`/activate\`
                    `)
                    .setFooter({ text: 'ALQUEEN License System' })
                    .setTimestamp()
            ]
        });
    }
};
