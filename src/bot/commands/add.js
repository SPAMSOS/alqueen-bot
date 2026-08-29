const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Ticket = require('../../database/models/Ticket');
const TicketLog = require('../../database/models/TicketLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('إضافة عضو للتكت')
        .setDescriptionLocalizations({
            'en-US': 'Add member to ticket'
        })
        .addUserOption(option =>
            option.setName('user')
                .setDescription('العضو المراد إضافته')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const user = interaction.options.getUser('user');

        // Find ticket channel
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
                        .setDescription('لم يتم العثور على هذا التكت.')
                ]
            });
        }

        // Check permissions
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            const guild = await client.guilds.fetch(interaction.guildId);
            const member = await guild.members.fetch(interaction.user.id);
            const supportRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('support') || r.name.toLowerCase().includes('دعم'));

            if (!supportRole || !member.roles.cache.has(supportRole.id)) {
                if (ticket.userId !== interaction.user.id) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(config.colors.danger)
                                .setTitle('⛔ لا تملك الصلاحية')
                                .setDescription('فقط صاحب التكت أو فريق الدعم يمكنهم إضافة أعضاء.')
                        ],
                        ephemeral: true
                    });
                }
            }
        }

        try {
            // Add permission to channel
            const permission = {
                id: user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
            };

            await interaction.channel.permissionOverwrites.create(user.id, {
                ViewChannel: true,
                ReadMessageHistory: true
            });

            // Log action
            await TicketLog.create({
                guildId: interaction.guildId,
                ticketId: ticket.ticketId,
                action: 'user_added',
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

            const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ تم إضافة العضو')
                .setDescription(`تم إضافة ${user.tag} إلى التكت.`);

            await interaction.reply({ embeds: [successEmbed] });

            // Notify in channel
            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.info)
                        .setDescription(`👋 ${user} تم إضافته إلى التكت.`)
                ]
            });

        } catch (error) {
            console.error('Add user error:', error);
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('❌ حدث خطأ')
                        .setDescription('حدث خطأ أثناء إضافة العضو.')
                ]
            });
        }
    }
};
