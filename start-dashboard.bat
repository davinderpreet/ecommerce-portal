@echo off
echo 🚀 Starting Ecommerce Portal Dashboard...
echo.

cd /d "%~dp0frontend"

echo 📦 Installing dependencies...
npm install

echo.
echo 🎯 Starting development server...
echo Dashboard will be available at: http://localhost:5173
echo Navigate to /sales for M14 Real-time Sales Dashboard
echo.

npm run dev

pause
