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
            // Start Discord bot FIRST
            console.log('🤖 Starting Discord bot...');
            this.bot.login(process.env.DISCORD_TOKEN).catch(e => console.error('Bot login:', e));

            // Wait 2 seconds for bot to be ready
            await new Promise(r => setTimeout(r, 2000));

            // Start web server (no DB dependency)
            console.log('🌐 Starting web server...');
            this.webServer = new WebServer(this.bot);
            this.webServer.app.locals.client = this.bot;
            this.webServer.app.locals.io = this.webServer.io;
            await this.webServer.start();

            // Connect to database in background (non-blocking)
            console.log('📦 Connecting to database (background)...');
            this.database.connect(process.env.MONGODB_URI).catch(e => {
                console.error('❌ DB connection failed:', e.message);
            });

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎉 ALQUEEN Ticket Bot is running!');
            console.log(`🌐 Dashboard: ${process.env.DASHBOARD_URL || `http://localhost:${process.env.PORT || 3000}`}`);
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
