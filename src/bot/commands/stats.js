const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../config/settings');
const Guild = require('../../database/models/Guild');
const Ticket = require('../../database/models/Ticket');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('عرض إحصائيات التكتات')
        .setDescriptionLocalizations({
            'en-US': 'Show ticket statistics'
        })
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('عدد الأيام للاحصائيات')
                .setMinValue(1)
                .setMaxValue(90)
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const days = interaction.options.getInteger('days') || 7;
        const guild = await Guild.findOne({ guildId: interaction.guild.id });

        if (!guild) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.warning)
                        .setTitle('⚠️ لم يتم الإعداد')
                        .setDescription('لم يتم إعداد نظام التكتات بعد.')
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const since = new Date();
            since.setDate(since.getDate() - days);

            // Get stats
            const totalTickets = await Ticket.countDocuments({
                guildId: interaction.guild.id,
                createdAt: { $gte: since }
            });

            const openTickets = await Ticket.countDocuments({
                guildId: interaction.guild.id,
                status: 'open',
                createdAt: { $gte: since }
            });

            const closedTickets = await Ticket.countDocuments({
                guildId: interaction.guild.id,
                status: 'closed',
                createdAt: { $gte: since }
            });

            const avgRating = await Ticket.aggregate([
                {
                    $match: {
                        guildId: interaction.guild.id,
                        rating: { $exists: true, $ne: null },
                        createdAt: { $gte: since }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgRating: { $avg: '$rating' }
                    }
                }
            ]);

            // Calculate response time
            const ticketsWithResponse = await Ticket.find({
                guildId: interaction.guild.id,
                firstResponseAt: { $exists: true },
                createdAt: { $gte: since }
            });

            let avgResponseTime = 0;
            if (ticketsWithResponse.length > 0) {
                const totalResponseTime = ticketsWithResponse.reduce((acc, t) => {
                    return acc + (t.firstResponseAt - t.createdAt);
                }, 0);
                avgResponseTime = Math.round(totalResponseTime / ticketsWithResponse.length / 60000); // in minutes
            }

            const statsEmbed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle('📊 إحصائيات التكتات')
                .setDescription(`آخر **${days}** يوم`)
                .addFields(
                    {
                        name: '📁 إجمالي التكتات',
                        value: `\`${totalTickets}\``,
                        inline: true
                    },
                    {
                        name: '🟢 التكتات المفتوحة',
                        value: `\`${openTickets}\``,
                        inline: true
                    },
                    {
                        name: '🔴 المغلقة',
                        value: `\`${closedTickets}\``,
                        inline: true
                    },
                    {
                        name: '⭐ متوسط التقييم',
                        value: avgRating.length > 0
                            ? `\`${avgRating[0].avgRating.toFixed(1)} / 5\``
                            : '```diff\n- لا توجد تقييمات\n```',
                        inline: true
                    },
                    {
                        name: '⏱️ متوسط وقت الاستجابة',
                        value: avgResponseTime > 0
                            ? `\`${avgResponseTime} دقيقة\``
                            : '```diff\n- لا توجد بيانات\n```',
                        inline: true
                    },
                    {
                        name: '📈 نسبة الإغلاق',
                        value: totalTickets > 0
                            ? `\`${Math.round((closedTickets / totalTickets) * 100)}%\``
                            : '`0%`',
                        inline: true
                    }
                )
                .setFooter({ text: 'ALQUEEN Ticket System' })
                .setTimestamp();

            await interaction.editReply({ embeds: [statsEmbed] });

        } catch (error) {
            console.error('Stats error:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.danger)
                        .setTitle('❌ حدث خطأ')
                        .setDescription('حدث خطأ أثناء جلب الإحصائيات.')
                ]
            });
        }
    }
};
