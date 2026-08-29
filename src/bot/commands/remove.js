const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('إزالة عضو من التكت')
        .setDescriptionLocalizations({
            'en-US': 'Remove member from ticket'
        })
        .addUserOption(option =>
            option.setName('user')
                .setDescription('العضو المراد إزالته')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const user = interaction.options.getUser('user');

        const channelName = interaction.channel.name;
        if (!channelName?.startsWith('ticket-') && !channelName?.startsWith('تكت-')) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('⛔ قناة غير صالحة')
                        .setDescription('هذا الأمر يمكن استخدامه فقط في قنوات التكتات.')
                ],
                ephemeral: true
            });
        }

        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
        if (!ticket) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('❌ التكت غير موجود')
                ]
            });
        }

        try {
            await interaction.channel.permissionOverwrites.delete(user.id);

            await TicketLog.create({
                guildId: interaction.guildId,
                ticketId: ticket.ticketId,
                action: 'user_removed',
                performedBy: {
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    type: 'staff'
                },
                target: {
                    userId: user.id,
                    userTag: user.tag
                }
            });

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.warning)
                        .setTitle('👋 تم إزالة العضو')
                        .setDescription(`تم إزالة ${user.tag} من التكت.`)
                ]
            });

        } catch (error) {
            console.error('Remove user error:', error);
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('❌ حدث خطأ')
                ]
            });
        }
    }
};
