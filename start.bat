@echo off
chcp 65001 >nul
title ALQUEEN Ticket Bot

echo.
echo ╔════════════════════════════════════════════╗
echo ║      🎫 ALQUEEN Ticket Bot                 ║
echo ║      جاري تشغيل البوت...                  ║
echo ╚════════════════════════════════════════════╝
echo.

if not exist node_modules (
    echo ⚠️  الحزم غير مثبتة. جاري التثبيت...
    call install.bat
)

if not exist .env (
    echo ❌ ملف .env غير موجود!
    echo 📝 يرجى إنشاء ملف .env أولاً
    pause
    exit /b
)

node src/index.js

pause
