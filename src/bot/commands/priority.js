const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('priority')
        .setDescription('تغيير أولوية التكت')
        .setDescriptionLocalizations({
            'en-US': 'Change ticket priority'
        })
        .addStringOption(option =>
            option.setName('level')
                .setDescription('مستوى الأولوية')
                .setRequired(true)
                .addChoices(
                    { name: '🔵 عادي', value: 'normal' },
                    { name: '🟡 مرتفع', value: 'high' },
                    { name: '🔴 عاجل', value: 'urgent' }
                )
        ),

    async execute(interaction, client) {
        const priority = interaction.options.getString('level');

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

        const priorityEmojis = {
            low: '🔵',
            normal: '🔵',
            high: '🟡',
            urgent: '🔴'
        };

        const priorityLabels = {
            low: 'منخفض',
            normal: 'عادي',
            high: 'مرتفع',
            urgent: 'عاجل'
        };

        try {
            if (ticket) {
                const oldPriority = ticket.priority;
                ticket.priority = priority;
                await ticket.save();

                await TicketLog.create({
                    guildId: interaction.guildId,
                    ticketId: ticket.ticketId,
                    action: 'priority_changed',
                    performedBy: {
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        type: 'staff'
                    },
                    details: { oldPriority, newPriority: priority }
                });
            }

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(priority === 'urgent' ? config.colors.danger :
                                  priority === 'high' ? config.colors.warning :
                                  config.colors.info)
                        .setTitle(`${priorityEmojis[priority]} تم تغيير الأولوية`)
                        .setDescription(`أولوية التكت الآن: **${priorityLabels[priority]}**`)
                ]
            });

        } catch (error) {
            console.error('Priority error:', error);
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
