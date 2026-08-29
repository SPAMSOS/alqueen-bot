const mongoose = require('mongoose');

class Database {
    constructor() {
        this.connection = null;
    }

    async connect(uri) {
        try {
            await mongoose.connect(uri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
            });

            this.connection = mongoose.connection;

            this.connection.on('error', (err) => {
                console.error('❌ MongoDB Error:', err);
            });

            this.connection.on('disconnected', () => {
                console.warn('⚠️ MongoDB disconnected, attempting to reconnect...');
            });

            this.connection.on('reconnected', () => {
                console.log('✅ MongoDB reconnected');
            });

            console.log('✅ MongoDB connected successfully');
            return this.connection;
        } catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error.message);
            // Don't exit, let web server try
            console.log('⚠️  Continuing without database...');
        }
    }

    async disconnect() {
        if (this.connection) {
            await mongoose.disconnect();
            console.log('🔌 MongoDB disconnected');
        }
    }
}

module.exports = Database;
