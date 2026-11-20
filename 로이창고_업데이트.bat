@echo off
chcp 65001 > nul
setlocal
title 로이창고 업데이터

rem ============================================================
rem  로이창고 원클릭 업데이터 (Git 설치 불필요)
rem  더블클릭하면 GitHub에서 최신판을 받아
rem  %USERPROFILE%\Downloads\로이창고 폴더를 갱신합니다.
rem ============================================================

set "ZIPURL=https://github.com/lsj1266/roichanggo/archive/refs/heads/main.zip"
set "WORK=%TEMP%\roichanggo_upd_%RANDOM%"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -Command"

rem 다운로드 폴더 실제 위치 확인 (OneDrive로 옮겨 둔 경우 대비), 못 찾으면 기본값
set "DL=%USERPROFILE%\Downloads"
set "DLRAW="
for /f "tokens=2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" /v "{374DE290-123F-4565-9164-39C4925E467B}" 2^>nul ^| find "REG_"') do set "DLRAW=%%B"
if defined DLRAW call set "DLTEST=%DLRAW%"
if defined DLTEST if exist "%DLTEST%" set "DL=%DLTEST%"
set "DEST=%DL%\로이창고"

echo.
echo ============================================================
echo    로이창고 최신판 자동 업데이트
echo ============================================================
echo.

if exist "%WORK%" rmdir /s /q "%WORK%" >nul 2>&1
mkdir "%WORK%" >nul 2>&1
if not exist "%DEST%" mkdir "%DEST%" >nul 2>&1

echo [1/3] 최신판 내려받는 중...
%PS% "$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; try{[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12}catch{}; Invoke-WebRequest -Uri '%ZIPURL%' -OutFile '%WORK%\main.zip' -UseBasicParsing"
if errorlevel 1 goto FAIL
if not exist "%WORK%\main.zip" goto FAIL

echo [2/3] 압축 푸는 중...
%PS% "$ErrorActionPreference='Stop'; try{ Expand-Archive -Path '%WORK%\main.zip' -DestinationPath '%WORK%\x' -Force } catch { New-Item -ItemType Directory -Force -Path '%WORK%\x' | Out-Null; tar -xf '%WORK%\main.zip' -C '%WORK%\x' }"
if errorlevel 1 goto FAIL

set "SRC="
for /d %%D in ("%WORK%\x\*") do set "SRC=%%D"
if not defined SRC goto FAIL
if not exist "%SRC%\로이창고.html" goto FAIL

echo [3/3] 파일 갱신 중...
%PS% "$ErrorActionPreference='Stop'; $s='%SRC%'; $d='%DEST%'; Copy-Item -Path (Join-Path $s '로이창고.html') -Destination (Join-Path $d '로이창고.html') -Force; $ext = Join-Path $d '로이창고_수집기'; New-Item -ItemType Directory -Force -Path $ext | Out-Null; Copy-Item -Path (Join-Path $s '로이창고_수집기\*') -Destination $ext -Recurse -Force; if (Test-Path (Join-Path $s 'README.md')) { Copy-Item -Path (Join-Path $s 'README.md') -Destination $d -Force }; if (Test-Path (Join-Path $s '로이창고_업데이트.bat')) { Copy-Item -Path (Join-Path $s '로이창고_업데이트.bat') -Destination $d -Force }"
if errorlevel 1 goto FAIL
if not exist "%DEST%\로이창고.html" goto FAIL
if not exist "%DEST%\로이창고_수집기\manifest.json" goto FAIL

rmdir /s /q "%WORK%" >nul 2>&1

echo.
echo ============================================================
echo    업데이트 완료!
echo ============================================================
echo.
echo   저장 위치: %DEST%
echo.
echo   크롬 확장프로그램(chrome://extensions)에서
echo   새로고침 한 번만 누르세요.
echo.
echo   * 처음 설치라면 한 번만 더:
echo     chrome://extensions  우측 상단 [개발자 모드] 켜기
echo     -^> [압축해제된 확장 프로그램을 로드합니다]
echo     -^> 위 폴더 안의 '로이창고_수집기' 폴더 선택
echo.
echo   * 앱 실행: 위 폴더의 로이창고.html 더블클릭
echo.
pause
exit /b 0

:FAIL
echo.
echo ============================================================
echo    업데이트를 마치지 못했습니다
echo ============================================================
echo.
echo   - 인터넷 연결을 확인한 뒤 다시 더블클릭해 주세요.
echo   - 크롬이 파일을 잡고 있으면 크롬을 모두 닫고 다시 해 보세요.
echo   - 계속 안 되면 로이에게 이 화면을 보여 주세요.
echo.
if exist "%WORK%" rmdir /s /q "%WORK%" >nul 2>&1
pause
exit /b 1
