const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/settings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('عرض جميع الأوامر المتاحة')
        .setDescriptionLocalizations({
            'en-US': 'Show all available commands'
        }),

    async execute(interaction, client) {
        const helpEmbed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('📖 قائمة الأوامر - ALQUEEN')
            .setDescription('**جميع الأوامر المتاحة:**')
            .addFields(
                {
                    name: '⚙️ الإعداد',
                    value: '```\n/setup - إعداد نظام التكتات\n/panel - إعادة إرسال لوحة التكتات\n```',
                    inline: false
                },
                {
                    name: '📊 الإحصائيات',
                    value: '```\n/stats - عرض إحصائيات التكتات\n/help - عرض هذه القائمة\n```',
                    inline: false
                },
                {
                    name: '👥 إدارة التكتات (داخل التكت)',
                    value: '```\n/add @user - إضافة عضو\n/remove @user - إزالة عضو\n/rename [name] - إعادة تسمية\n/priority [level] - تغيير الأولوية\n```',
                    inline: false
                }
            )
            .setFooter({ text: 'ALQUEEN Ticket System • /setup للبدء' })
            .setTimestamp();

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
};
