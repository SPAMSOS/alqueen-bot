const { Events, ActivityType } = require('discord.js');
const { REST } = require('discord.js');
const { Routes } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Logged in as ${client.user.tag}`);
        console.log(`🌐 Serving ${client.guilds.cache.size} servers`);
        console.log(`👥 ${client.users.cache.size} users`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Register slash commands - GLOBAL (for all servers)
        const rest = new REST({ version: '10' }).setToken(client.token);
        const commands = client.slashCommands.map(cmd => cmd.data.toJSON());

        try {
            console.log('🔄 Registering GLOBAL slash commands...');

            // Always register as GLOBAL commands (works on all servers)
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log(`✅ Registered ${commands.length} global commands (available in all servers)`);
        } catch (error) {
            console.error('❌ Failed to register commands:', error);
        }

        // Update activity periodically
        setInterval(() => {
            const activities = [
                { name: '🎫 ALQUEEN Ticket System', type: ActivityType.Watching },
                { name: `${client.guilds.cache.size} سيرفر 🌍`, type: ActivityType.Listening },
                { name: '/setup لإنشاء النظام', type: ActivityType.Playing },
                { name: `${client.users.cache.size} مستخدم 👥`, type: ActivityType.Watching },
                { name: 'discord.gg/yourserver', type: ActivityType.Playing }
            ];

            const activity = activities[Math.floor(Math.random() * activities.length)];
            client.user.setActivity(activity);
        }, 30000);
    }
};
