# 🚀 دليل التثبيت والتشغيل

## المتطلبات الأساسية

قبل البدء، تأكد من تثبيت:
- **Node.js** 18+ من [nodejs.org](https://nodejs.org)
- **MongoDB** Community Edition من [mongodb.com](https://www.mongodb.com/try/download/community)
- **Git** (اختياري)

## 📥 خطوات التثبيت

### 1. تحميل المشروع
```bash
git clone <repository-url>
cd ALQUEEN
```

### 2. تثبيت الحزم
```bash
npm install
```

أو على Windows:
```bash
install.bat
```

### 3. إعداد Discord Bot

#### أ) إنشاء بوت جديد
1. اذهب إلى [Discord Developer Portal](https://discord.com/developers/applications)
2. اضغط على **"New Application"**
3. اختر اسم للبوت
4. اذهب إلى قسم **"Bot"**
5. اضغط **"Reset Token"** واحفظ الـ Token
6. فعّل الخيارات التالية:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent

#### ب) دعوة البوت للسيرفر
1. اذهب إلى **"OAuth2" > "URL Generator"**
2. اختر الـ Scopes:
   - `bot`
   - `applications.commands`
3. اختر Bot Permissions:
   - Administrator (أو الصلاحيات المطلوبة)
4. انسخ الرابط وافتحه في المتصفح
5. اختر سيرفرك وأكمل الإضافة

#### ج) الحصول على IDs
- **Client ID**: في صفحة Application Information
- **Guild ID**: فعّل Developer Mode في Discord، ثم كليك يمين على السيرفر > Copy ID
- **Role IDs**: كليك يمين على الرول > Copy ID

### 4. إعداد ملف البيئة

انسخ `.env.example` إلى `.env` وعدّل القيم:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
MONGODB_URI=mongodb://localhost:27017/alqueen-tickets
PORT=3000
```

### 5. تشغيل MongoDB

تأكد من تشغيل MongoDB قبل بدء البوت:
```bash
mongod
```

أو على Windows كخدمة:
```bash
net start MongoDB
```

### 6. تشغيل البوت

```bash
npm start
```

أو:
```bash
start.bat
```

## 🎯 إعداد النظام

### 1. إنشاء الرولات
في سيرفر Discord، أنشئ الرولات التالية:
- 👑 **Admin** - للمديرين
- 🎧 **Support** - لفريق الدعم
- 🆘 **Helper** - للمساعدين (اختياري)

### 2. إعداد البوت في السيرفر
في أي قناة، اكتب:
```
/setup
```

سيتم تلقائياً:
- ✅ إنشاء قسم التكتات
- ✅ إنشاء قناة اللوحة
- ✅ إنشاء قناة السجلات
- ✅ إنشاء قناة الترانسكريبت
- ✅ إرسال رسالة الترحيب

### 3. إعداد الصلاحيات
1. اذهب إلى إعدادات القسم الذي تم إنشاؤه
2. أضف رولات **Support** و **Admin** بصلاحية **View Channel**

## 🌐 الوصول للوحة التحكم

افتح المتصفح واذهب إلى:
```
http://localhost:3000
```

سجّل دخول بحساب Discord الخاص بك.

## 📝 الأوامر المتاحة

| الأمر | الوصف |
|------|------|
| `/setup` | إعداد نظام التكتات |
| `/panel` | إعادة إرسال لوحة التكتات |
| `/stats` | عرض الإحصائيات |
| `/add` | إضافة عضو للتكت |
| `/remove` | إزالة عضو من التكت |
| `/rename` | إعادة تسمية التكت |
| `/priority` | تغيير الأولوية |

## 🔧 حل المشاكل

### البوت لا يستجيب
- ✅ تأكد من تفعيل Message Content Intent
- ✅ تأكد من صحة الـ Token
- ✅ تأكد من صلاحيات البوت

### خطأ MongoDB
- ✅ تأكد من تشغيل MongoDB
- ✅ تأكد من صحة MONGODB_URI
- ✅ جرّب `mongodb://127.0.0.1:27017/alqueen-tickets`

### لوحة التحكم لا تعمل
- ✅ تأكد من تشغيل البوت
- ✅ تأكد من المنفذ 3000 غير مستخدم
- ✅ افحص الـ Console للأخطاء

## 📞 الدعم

- Discord: [رابط الدعم]
- Email: support@alqueen.com
- GitHub Issues: [رابط]

## 🔐 الأمان

- ⚠️ لا تشارك الـ Token مع أحد
- ⚠️ استخدم ملف `.env` للمعلومات الحساسة
- ⚠️ فعّل 2FA على حساب Discord
- ⚠️ قيّد صلاحيات البوت على ما يلزم فقط

## 📄 الترخيص

MIT License - راجع ملف LICENSE
