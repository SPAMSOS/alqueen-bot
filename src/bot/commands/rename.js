const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('إعادة تسمية التكت')
        .setDescriptionLocalizations({
            'en-US': 'Rename ticket'
        })
        .addStringOption(option =>
            option.setName('name')
                .setDescription('الاسم الجديد للتكت')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const newName = interaction.options.getString('name');

        const channelName = interaction.channel.name;
        if (!channelName?.startsWith('ticket-') && !channelName?.startsWith('تكت-')) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('⛔ قناة غير صالحة')
                ],
                ephemeral: true
            });
        }

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('⛔ لا تملك الصلاحية')
                ],
                ephemeral: true
            });
        }

        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

        try {
            const oldName = interaction.channel.name;
            await interaction.channel.setName(`ticket-${newName}`);

            if (ticket) {
                ticket.subject = newName;
                await ticket.save();

                await TicketLog.create({
                    guildId: interaction.guildId,
                    ticketId: ticket.ticketId,
                    action: 'renamed',
                    performedBy: {
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        type: 'staff'
                    },
                    details: { oldName, newName }
                });
            }

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setTitle('✏️ تم تغيير الاسم')
                        .setDescription(`تم تغيير اسم التكت إلى \`${newName}\``)
                ]
            });

        } catch (error) {
            console.error('Rename error:', error);
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
