const mongoose = require('mongoose');

class Database {
    constructor() {
        this.connection = null;
    }

    async connect(uri) {
        try {
            // Ensure we don't try to reconnect if already connected
            if (mongoose.connection.readyState === 1) {
                console.log('✅ MongoDB already connected');
                return mongoose.connection;
            }

            await mongoose.connect(uri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 15000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 15000,
                waitQueueTimeoutMS: 30000,
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
