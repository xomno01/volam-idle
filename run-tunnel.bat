@echo off
chcp 65001 >nul
title Cloudflare Tunnel - Vo Lam Online
color 0A

echo ===================================================================
echo     ⚔ VÕ LÂM ONLINE - KHỞI TẠO ĐƯỜNG HẦM CLOUDFLARE TUNNEL ⚔
echo           (Chơi Online qua Internet - Không cần mở port)
echo ===================================================================
echo.

set "CF_EXE=%~dp0cloudflared.exe"

if not exist "%CF_EXE%" (
    echo [1/2] Đang tải cloudflared.exe từ Cloudflare chính thức...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CF_EXE%'"
    if not exist "%CF_EXE%" (
        echo [LỖI] Không thể tải cloudflared.exe. Vui lòng kiểm tra kết nối mạng.
        pause
        exit /b 1
    )
    echo [XONG] Đã tải xong cloudflared.exe!
) else (
    echo [1/2] Đã tìm thấy cloudflared.exe sẵn sàng!
)

echo.
echo [2/2] Đang tạo đường hầm kết nối tới http://localhost:3000...
echo.
echo ===================================================================
echo LƯU Ý QUAN TRỌNG:
echo Khi đường hầm bật lên, tìm dòng có link dạng:
echo   https://xxxx-xxxx-xxxx.trycloudflare.com
echo Copy link đó gửi cho bạn bè để cùng chơi Online từ xa!
echo ===================================================================
echo.

"%CF_EXE%" tunnel --url http://localhost:3000
pause
