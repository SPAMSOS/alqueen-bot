# 🚀 دليل الاستضافة المجانية 100%

## البوت + الموقع على استضافة مجانية + قاعدة بيانات مجانية

---

## 📋 خطة الاستضافة المجانية الكاملة

| الخدمة | المجانية | الرابط |
|--------|---------|--------|
| 🤖 استضافة البوت | Render.com (750 ساعة/شهر) | [render.com](https://render.com) |
| 🗄️ قاعدة البيانات | MongoDB Atlas (512MB) | [mongodb.com/atlas](https://mongodb.com/atlas) |
| 🌐 الموقع (اختياري) | Vercel | [vercel.com](https://vercel.com) |

---

## 🎯 خطوات الرفع على Render.com (مجاني)

### الخطوة 1: تجهيز المشروع على GitHub

أول شيء: ارفع المشروع على GitHub

```bash
# في مجلد المشروع
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/اسم-المستخدم-الخاص-بك/alqueen-bot.git
git push -u origin main
```

### الخطوة 2: إنشاء حساب على Render

1. اذهب لـ [render.com](https://render.com)
2. سجل بـ GitHub
3. اضغط **"New +"** > **"Web Service"**
4. اختر الـ repository اللي رفعته

### الخطوة 3: إعدادات Render

```
Name: alqueen-ticket-bot
Environment: Node
Region: Frankfurt (أقرب لك)
Branch: main
Build Command: npm install
Start Command: npm start
Plan: Free
```

### الخطوة 4: إضافة Environment Variables في Render

في صفحة الإعدادات، أضف المتغيرات التالية:

```
DISCORD_TOKEN = التوكن_الخاص_بك
CLIENT_ID = رقم_كلاينت_الخاص_بك
MONGODB_URI = رابط_MongoDB_Atlas
DASHBOARD_URL = https://alqueen-ticket-bot.onrender.com
SESSION_SECRET = أي_نص_عشوائي_طويل
CLIENT_SECRET = سكرت_الأوث_الخاص_بك
CALLBACK_URL = https://alqueen-ticket-bot.onrender.com/auth/callback
PORT = 3000
```

### الخطوة 5: اضغط Deploy!

---

## 🗄️ إعداد MongoDB Atlas (مجاني)

### الخطوة 1: إنشاء حساب
1. اذهب لـ [mongodb.com/atlas](https://mongodb.com/atlas)
2. اضغط **Try Free**
3. سجل بحساب Google

### الخطوة 2: إنشاء Database
1. اضغط **Build a Database**
2. اختر **FREE (M0)**
3. اختار Region قريبة منك
4. اضغط **Create**

### الخطوة 3: إعداد الأمان
1. اضغط **Database Access** (من القائمة الجانبية)
2. اضغط **Add New Database User**
3. Username: `alqueen`
4. Password: (اختر كلمة سر قوية واحفظها)
5. اضغط **Add User**

### الخطوة 4: السماح بالاتصال
1. اضغط **Network Access**
2. اضغط **Add IP Address**
3. اختر **Allow Access from Anywhere** (0.0.0.0/0)
4. اضغط **Confirm**

### الخطوة 5: الحصول على Connection String
1. ارجع لـ **Database**
2. اضغط **Connect** على الـ cluster
3. اختر **Connect your application**
4. انسخ الرابط وعدّل عليه:
   - استبدل `<username>` باسم المستخدم
   - استبدل `<password>` بكلمة السر

**مثال:**
```
mongodb+srv://alqueen:MyPassword123@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

---

## 🤖 إعداد Discord Bot

### 1. إنشاء البوت
1. اذهب لـ [Discord Developer Portal](https://discord.com/developers/applications)
2. اضغط **New Application**
3. سمّه مثلاً `ALQUEEN Ticket`
4. اذهب لـ **Bot** واضغط **Add Bot**
5. اضغط **Reset Token** وانسخه

### 2. تفعيل Intents
في صفحة Bot:
- ✅ Presence Intent
- ✅ Server Members Intent
- ✅ Message Content Intent

### 3. دعوة البوت
1. اذهب لـ **OAuth2 > URL Generator**
2. Scopes:
   - `bot`
   - `applications.commands`
3. Bot Permissions:
   - Administrator
4. انسخ الرابط وافتحه

### 4. إضافة OAuth2 للوحة التحكم
1. في نفس صفحة OAuth2
2. أضف Redirect URI:
   ```
   https://alqueen-ticket-bot.onrender.com/auth/callback
   ```
3. انسخ **Client Secret**

### 5. الحصول على Client ID
من **Application Information** انسخ **Application ID**

---

## 🎯 إضافة البوت لسيرفرك

1. افتح الرابط اللي نسخته من OAuth2
2. اختر سيرفرك
3. اضغط **Authorize**
4. أكمل الـ Captcha
5. البوت يدخل سيرفرك! 🎉

---

## ✅ التحقق من العمل

### 1. تحقق من Render
- افتح [dashboard.render.com](https://dashboard.render.com)
- شوف الـ Logs - لازم تشوف:
```
✅ Logged in as ALQUEEN#1234
🌐 Serving X servers
✅ MongoDB connected successfully
```

### 2. تحقق من الموقع
- افتح: `https://alqueen-ticket-bot.onrender.com`
- لازم تشوف الصفحة الرئيسية

### 3. اختبر البوت
- في سيرفر Discord، اكتب `/`
- لازم تشوف أوامر البوت
- جرّب `/setup`

---

## ⚠️ ملاحظات مهمة

### Render Free Plan:
- ⚠️ يتوقف بعد 15 دقيقة من عدم النشاط
- ✅ يستيقظ تلقائياً عند الاستخدام
- 💡 750 ساعة/شهر مجاناً

### الحل: استخدام UptimeRobot (مجاني)
لإبقاء البوت نشط 24/7:

1. اذهب لـ [uptimerobot.com](https://uptimerobot.com)
2. سجل حساب مجاني
3. اضغط **Add New Monitor**
4. Monitor Type: **HTTP(s)**
5. URL: `https://alqueen-ticket-bot.onrender.com`
6. Monitoring Interval: **5 minutes**
7. اضغط **Create Monitor**

هذي الطريقة تخلي Render ما يوقف البوت! 🚀

---

## 🎉 النتيجة النهائية

- ✅ بوتك شغال 24/7
- ✅ مجاني 100%
- ✅ يعمل في كل السيرفرات
- ✅ لوحة تحكم ويب متاحة
- ✅ قاعدة بيانات سحابية

---

## 🆘 حل المشاكل

### البوت لا يستجيب؟
- تأكد من إضافة الـ Environment Variables صحيحة
- شوف Logs في Render
- تأكد من تفعيل Intents في Discord

### خطأ MongoDB؟
- تأكد من إضافة IP 0.0.0.0/0 في Network Access
- تأكد من صحة username/password

### الموقع لا يعمل؟
- تأكد من إضافة DASHBOARD_URL صحيح
- شوف Logs في Render

---

## 📞 إذا احتجت مساعدة

اسألني عن أي خطوة تواجهك مشكلة فيها! 💪
