const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const Guild = require('../../database/models/Guild');

module.exports = {
    name: Events.GuildCreate,
    once: false,
    async execute(guild, client) {
        console.log(`➕ Joined new guild: ${guild.name} (${guild.id})`);

        try {
            // Save guild to database
            let guildData = await Guild.findOne({ guildId: guild.id });
            if (!guildData) {
                guildData = new Guild({
                    guildId: guild.id,
                    name: guild.name,
                    ownerId: guild.ownerId,
                    memberCount: guild.memberCount
                });
                await guildData.save();
            }

            // Try to send welcome message to system channel
            const systemChannel = guild.systemChannel;
            if (systemChannel && systemChannel.permissionsFor(client.user).has('SendMessages')) {
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🎫 شكراً لإضافة ALQUEEN!')
                    .setDescription(`
**مرحباً بك في نظام التكتات الاحترافي!**

━━━━━━━━━━━━━━━━━━━━━━━━
**🚀 للبدء:**
1️⃣ استخدم الأمر \`/setup\` لإنشاء نظام التكتات
2️⃣ خصص الإعدادات من لوحة التحكم
3️⃣ ابدأ في استقبال التكتات!

**🌐 لوحة التحكم:**
> زُر الموقع لإدارة سيرفراتك من المتصفح

**📌 الأوامر المتاحة:**
> \`/setup\` - إعداد النظام
> \`/panel\` - إرسال لوحة التكتات
> \`/stats\` - عرض الإحصائيات
                    `)
                    .setFooter({ text: 'ALQUEEN Ticket System' })
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('auto_setup')
                            .setLabel('⚡ إعداد سريع')
                            .setStyle(ButtonStyle.Primary)
                    );

                await systemChannel.send({ embeds: [welcomeEmbed], components: [row] });
            }
        } catch (error) {
            console.error('Error in guildCreate:', error);
        }
    }
};
