const { Events } = require('discord.js');
const Guild = require('../../database/models/Guild');

module.exports = {
    name: Events.GuildDelete,
    once: false,
    async execute(guild, client) {
        console.log(`➖ Left guild: ${guild.name} (${guild.id})`);
        // Optional: Mark guild as inactive or delete data
    }
};
