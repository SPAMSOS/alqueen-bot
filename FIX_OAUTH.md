# 🔧 إصلاح OAuth - مهم جداً!

## المشكلة:
الـ `client_id` اللي عندك (`31VlrdHbWL5A7JXydtrwf5OR8QlSB4iZ`) خطأ! هو ما يشبه Discord Snowflake.

## Discord Snowflake لازم يكون:
- ✅ **أرقام فقط**
- ✅ من 17 إلى 20 رقم
- مثال صحيح: `1234567890123456789`

## ❌ اللي عندك:
`31VlrdHbWL5A7JXydtrwf5OR8QlSB4iZ` - فيه حروف!

## ✅ كيف تحصل على Client ID الصحيح:

### الطريقة 1: من Discord Developer Portal
1. افتح: https://discord.com/developers/applications
2. اختار تطبيقك
3. في **Application Information** القسم الأول
4. اضغط **Copy** تحت **APPLICATION ID**
5. لازم يكون **أرقام فقط** بدون حروف

### الطريقة 2: من Discord نفسه
1. فعّل Developer Mode في Discord
2. كليك يمين على البوت (أو أي مستخدم)
3. Copy User ID - هذا هو الـ Client ID الصحيح

## 📋 بعد ما تحصل على Client ID الصحيح:

### أضف Environment Variables في Render:

```
CLIENT_ID = 1234567890123456789  (الأرقام الصحيحة)
DISCORD_TOKEN = MTU0MzI3NjA1MTA5MjczNDAyMg.GBidEK... (موجود)
CLIENT_SECRET = XXXX_كلمة_سر_جديدة_من_هنا
```

### للحصول على CLIENT_SECRET:
1. في Discord Developer Portal
2. OAuth2 → General
3. اضغط **Reset Secret**
4. انسخه (بيظهر مرة واحدة!)
5. أضفه في Render Environment

### أضف Redirect URI:
1. في OAuth2 → General
2. **Redirects** → اضغط **Add Redirect**
3. أضف: `https://alqueen-bot.onrender.com/auth/callback`
4. اضغط **Save Changes**

## ⚠️ ملاحظة:
الـ **Client ID** و **Client Secret** مختلفين عن **Bot Token**!
- **Bot Token**: للدخول للبوت (موجود)
- **Client ID + Client Secret**: لتسجيل دخول OAuth
