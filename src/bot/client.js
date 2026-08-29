const { Client, GatewayIntentBits, Partials, Collection, ActivityType } = require('discord.js');
const path = require('path');
const fs = require('fs');

class TicketBot extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ],
            partials: [
                Partials.Message,
                Partials.Channel,
                Partials.Reaction,
                Partials.GuildMember
            ]
        });

        this.commands = new Collection();
        this.slashCommands = new Collection();
        this.cooldowns = new Collection();
        this.dashboardIO = null;
        this.startTime = Date.now();

        this.loadEvents();
        this.loadCommands();
    }

    loadEvents() {
        const eventsPath = path.join(__dirname, 'events');
        if (!fs.existsSync(eventsPath)) return;

        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);

            if (event.once) {
                this.once(event.name, (...args) => event.execute(...args, this));
            } else {
                this.on(event.name, (...args) => event.execute(...args, this));
            }
        }
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(commandsPath)) return;

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);

            if ('data' in command && 'execute' in command) {
                this.slashCommands.set(command.data.name, command);
            }
        }
    }

    async start(token) {
        await this.login(token);
        this.user.setActivity({
            name: '🎫 ALQUEEN | /setup',
            type: ActivityType.Watching
        });
    }

    getUptime() {
        const uptime = Date.now() - this.startTime;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        return { days, hours, minutes, total: uptime };
    }

    async getStats() {
        return {
            guilds: this.guilds.cache.size,
            users: this.users.cache.size,
            channels: this.channels.cache.size,
            commands: this.slashCommands.size,
            uptime: this.getUptime(),
            ping: this.ws.ping,
            memory: process.memoryUsage()
        };
    }
}

module.exports = TicketBot;
