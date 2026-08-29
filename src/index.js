require('dotenv').config();

const TicketBot = require('./bot/client');
const Database = require('./database/connection');
const WebServer = require('./web/server');

class Application {
    constructor() {
        this.bot = new TicketBot();
        this.database = new Database();
        this.webServer = null;
    }

    async start() {
        try {
            // Connect to database
            console.log('📦 Connecting to database...');
            await this.database.connect(process.env.MONGODB_URI);

            // Start web server
            console.log('🌐 Starting web server...');
            this.webServer = new WebServer(this.bot);
            this.webServer.app.locals.client = this.bot;
            await this.webServer.start();

            // Start Discord bot
            console.log('🤖 Starting Discord bot...');
            await this.bot.start(process.env.DISCORD_TOKEN);

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎉 ALQUEEN Ticket Bot is running!');
            console.log(`🌐 Dashboard: ${process.env.DASHBOARD_URL || `http://localhost:${process.env.PORT || 3000}`}`);
            console.log(`🌍 Active in ${this.bot.guilds.cache.size} servers`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        } catch (error) {
            console.error('❌ Failed to start:', error);
            process.exit(1);
        }
    }

    async stop() {
        console.log('🛑 Shutting down...');
        try {
            await this.database.disconnect();
            await this.bot.destroy();
        } catch (e) {}
        process.exit(0);
    }
}

const app = new Application();
process.on('SIGINT', () => app.stop());
process.on('SIGTERM', () => app.stop());
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

app.start();
