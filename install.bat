@echo off
chcp 65001 >nul
title ALQUEEN Ticket Bot - Installer

echo.
echo ╔════════════════════════════════════════════╗
echo ║                                            ║
echo ║   🎫 ALQUEEN Ticket Bot - Installer        ║
echo ║                                            ║
echo ╚════════════════════════════════════════════╝
echo.

echo 📦 جاري تثبيت الحزم...
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo ❌ فشل التثبيت. تأكد من تثبيت Node.js
    pause
    exit /b
)

echo.
echo ✅ تم تثبيت الحزم بنجاح!
echo.

if not exist .env (
    echo 📝 إنشاء ملف .env...
    copy .env.example .env
    echo ⚠️  يرجى تعديل ملف .env وإضافة الـ tokens
)

echo.
echo 🚀 للتشغيل: npm start
echo 🧪 للإعداد: npm run setup
echo.

pause
