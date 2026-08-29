require('dotenv').config();

console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║   🎫 ALQUEEN Ticket Bot - Setup Wizard     ║
║                                            ║
╚════════════════════════════════════════════╝

مرحباً بك في معالج إعداد بوت ALQUEEN!
`);

// Check required files
const fs = require('fs');
const path = require('path');

const requiredFiles = [
    '.env',
    'src/config/settings.js'
];

console.log('📋 جاري التحقق من الملفات المطلوبة...\n');

requiredFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} موجود`);
    } else {
        console.log(`❌ ${file} غير موجود`);
    }
});

// Create .env if not exists
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
    fs.writeFileSync(envPath, envExample);
    console.log('\n✅ تم إنشاء ملف .env من النموذج');
    console.log('⚠️  يرجى تعديل ملف .env وإضافة الـ tokens الخاصة بك');
} else {
    console.log('\n✅ ملف .env موجود بالفعل');
}

// Check environment variables
console.log('\n📝 متغيرات البيئة المطلوبة:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const requiredEnvVars = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'MONGODB_URI'
];

requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value && value !== 'your_' + varName.toLowerCase() + '_here') {
        console.log(`✅ ${varName}: ****`);
    } else {
        console.log(`⚠️  ${varName}: غير مضاف`);
    }
});

console.log(`
╔════════════════════════════════════════════╗
║         خطوات التشغيل                      ║
╠════════════════════════════════════════════╣
║                                            ║
║  1. قم بتعديل ملف .env                    ║
║  2. أضف Bot Token من Discord Developer     ║
║  3. أضف Client ID                         ║
║  4. تأكد من تشغيل MongoDB                 ║
║  5. شغل الأمر: npm start                  ║
║                                            ║
╚════════════════════════════════════════════╝
`);

// Install dependencies reminder
console.log('💡 لا تنسى تثبيت الحزم: npm install\n');

// Quick test connection
async function testConnections() {
    console.log('🧪 جاري اختبار الاتصالات...\n');

    // Test MongoDB
    try {
        const mongoose = require('mongoose');
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alqueen-tickets';
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
        console.log('✅ MongoDB: متصل');
        await mongoose.disconnect();
    } catch (error) {
        console.log('⚠️  MongoDB: غير متصل (تأكد من تشغيل الخادم)');
    }

    console.log('\n✅ تم الانتهاء من الإعداد!');
    console.log('🚀 شغل `npm start` لتشغيل البوت\n');
}

testConnections().catch(console.error);
