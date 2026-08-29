const mongoose = require('mongoose');

// Increase mongoose buffering timeout
mongoose.set('bufferTimeoutMS', 30000);

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

            // Ensure URI has database name
            let cleanUri = uri;
            if (cleanUri.endsWith('/') || !cleanUri.match(/\.net\/[^?]+/)) {
                cleanUri = cleanUri.replace(/\.net\/?(\?.*)?$/, '.net/alqueen$1');
            }

            console.log('🔗 Connecting to MongoDB...');
            await mongoose.connect(cleanUri, {
                maxPoolSize: 5,
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 60000,
                connectTimeoutMS: 30000,
                waitQueueTimeoutMS: 30000,
                authSource: 'admin'
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
