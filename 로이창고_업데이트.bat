@echo off
chcp 65001 > nul
setlocal
title 로이창고 업데이터

rem ============================================================
rem  로이창고 원클릭 업데이터 (Git 설치 불필요)
rem  더블클릭하면 GitHub에서 최신판을 받아
rem  C:\로이창고 폴더를 갱신하고,
rem  바탕화면에 '로이창고' 아이콘을 만들고, 앱을 바로 엽니다.
rem  예전 판은 다운로드\로이창고 에 설치했는데, 다운로드 폴더를 비우면
rem  지워져서 C:\로이창고 로 옮겼습니다. (그 폴더는 지워지지 않습니다)
rem ============================================================

set "ZIPURL=https://github.com/lsj1266/roichanggo/archive/refs/heads/main.zip"
set "WORK=%TEMP%\roichanggo_upd_%RANDOM%"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -Command"

rem 설치 폴더: C:\로이창고
rem   미리 ROICHANGGO_HOME 환경변수를 정해 두면 그 폴더에 설치합니다.
if not defined ROICHANGGO_HOME set "ROICHANGGO_HOME=C:\로이창고"
set "DEST=%ROICHANGGO_HOME%"
set "RUNFROM=%~dp0"

rem 구글 크롬을 먼저 찾습니다 - 있으면 크롬으로 열고, 없을 때만 기본 브라우저로 엽니다
rem 확인 순서: Program Files -> Program Files x86 -> LocalAppData
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

echo.
echo ============================================================
echo    로이창고 최신판 자동 업데이트
echo ============================================================
echo.

rem ---------- 설치 폴더 준비: 없으면 만들고, 쓸 수 있는지 확인 ----------
if not exist "%DEST%" mkdir "%DEST%" >nul 2>&1
call :WRITETEST "%DEST%"
if not errorlevel 1 goto DESTREADY

echo   * %DEST% 폴더를 만들거나 쓸 수 없습니다.
echo     사용자 폴더로 대신 설치합니다.
set "DEST=%USERPROFILE%\로이창고"
if not exist "%DEST%" mkdir "%DEST%" >nul 2>&1
call :WRITETEST "%DEST%"
if errorlevel 1 goto NODEST
:DESTREADY

if /i not "%RUNFROM:~0,-1%"=="%DEST%" echo   * 예전 폴더에서 실행되어 %DEST% 로 새로 설치합니다.

if exist "%WORK%" rmdir /s /q "%WORK%" >nul 2>&1
mkdir "%WORK%" >nul 2>&1

echo [1/4] 최신판 내려받는 중...
%PS% "$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; try{[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12}catch{}; Invoke-WebRequest -Uri '%ZIPURL%' -OutFile '%WORK%\main.zip' -UseBasicParsing"
if errorlevel 1 goto FAIL
if not exist "%WORK%\main.zip" goto FAIL

echo [2/4] 압축 푸는 중...
%PS% "$ErrorActionPreference='Stop'; try{ Expand-Archive -Path '%WORK%\main.zip' -DestinationPath '%WORK%\x' -Force } catch { New-Item -ItemType Directory -Force -Path '%WORK%\x' | Out-Null; tar -xf '%WORK%\main.zip' -C '%WORK%\x' }"
if errorlevel 1 goto FAIL

set "SRC="
for /d %%D in ("%WORK%\x\*") do set "SRC=%%D"
if not defined SRC goto FAIL
if not exist "%SRC%\로이창고.html" goto FAIL

echo [3/4] 파일 갱신 중... %DEST%
%PS% "$ErrorActionPreference='Stop'; $s='%SRC%'; $d='%DEST%'; Copy-Item -Path (Join-Path $s '로이창고.html') -Destination (Join-Path $d '로이창고.html') -Force; $ext = Join-Path $d '로이창고_수집기'; New-Item -ItemType Directory -Force -Path $ext | Out-Null; Copy-Item -Path (Join-Path $s '로이창고_수집기\*') -Destination $ext -Recurse -Force; if (Test-Path (Join-Path $s 'README.md')) { Copy-Item -Path (Join-Path $s 'README.md') -Destination $d -Force }; if (Test-Path (Join-Path $s '로이창고_업데이트.bat')) { Copy-Item -Path (Join-Path $s '로이창고_업데이트.bat') -Destination $d -Force }; try { if (Test-Path (Join-Path $s '로이창고.ico')) { Copy-Item -Path (Join-Path $s '로이창고.ico') -Destination (Join-Path $d '로이창고.ico') -Force } } catch {}"
if errorlevel 1 goto FAIL
if not exist "%DEST%\로이창고.html" goto FAIL
if not exist "%DEST%\로이창고_수집기\manifest.json" goto FAIL

echo [4/4] 바탕화면 아이콘 만들기...
rem 한글 파일명은 코드값으로 만들어 인코딩 문제를 피합니다 (로이창고 = B85C C774 CC3D ACE0)
rem 아이콘은 로이창고 전용 .ico(초록 배지 + 택배 박스)를 씁니다 - 크롬 아이콘과 겹치지 않습니다.
rem 그 파일이 없을 때만 예전처럼 크롬(또는 엣지) 아이콘으로 대신합니다.
%PS% "$ErrorActionPreference='SilentlyContinue'; $ro=[string][char]0xB85C+[string][char]0xC774+[string][char]0xCC3D+[string][char]0xACE0; $dest='%DEST%'; $html=Join-Path $dest ($ro+'.html'); if(-not (Test-Path $html)){ exit 2 }; $ico=Join-Path $dest ($ro+'.ico'); if(-not (Test-Path $ico)){ $ico='' }; $reg=(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' -Name Desktop -ErrorAction SilentlyContinue).Desktop; $desk=[Environment]::ExpandEnvironmentVariables([string]$reg); if(-not $desk -or -not (Test-Path $desk)){ $desk=[Environment]::GetFolderPath('Desktop') }; if(-not $desk -or -not (Test-Path $desk)){ $desk=Join-Path $env:USERPROFILE 'Desktop' }; if(-not (Test-Path $desk)){ New-Item -ItemType Directory -Force -Path $desk | Out-Null }; $ws=New-Object -ComObject WScript.Shell; $lnk=Join-Path $desk ($ro+'.lnk'); $sc=$ws.CreateShortcut($lnk); $q=[string][char]34; $sc.TargetPath=$html; $sc.Arguments=''; $chrome=[string]$env:CHROME; if($chrome -ne '' -and (Test-Path $chrome)){ $sc.TargetPath=$chrome; $sc.Arguments=($q+$html+$q); if($ico -ne ''){ $sc.IconLocation=($ico+',0') } else { $sc.IconLocation=($chrome+',0') } } else { $edge=Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'; if($ico -ne ''){ $sc.IconLocation=($ico+',0') } elseif(Test-Path $edge){ $sc.IconLocation=($edge+',0') } }; $sc.WorkingDirectory=$dest; $sc.Description=$ro; $sc.Save(); if(Test-Path $lnk){ exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo   바탕화면 아이콘은 만들지 못했습니다 ^(앱은 정상 설치되었습니다^)
) else (
  echo   바탕화면에 [로이창고] 아이콘을 만들었습니다.
  if not exist "%DEST%\로이창고.ico" echo   ^(전용 아이콘 파일을 받지 못해 크롬 아이콘으로 대신 표시합니다^)
)

rmdir /s /q "%WORK%" >nul 2>&1

echo.
echo ============================================================
echo    업데이트 완료!
echo ============================================================
echo.
echo   저장 위치: %DEST%
echo.
echo   크롬 확장프로그램(chrome://extensions)에서
echo   아래 폴더의 '로이창고_수집기' 를 한 번만 다시 불러오세요.
echo     %DEST%\로이창고_수집기
echo.
echo   * 처음 설치라면 한 번만 더:
echo     chrome://extensions  우측 상단 [개발자 모드] 켜기
echo     -^> [압축해제된 확장 프로그램을 로드합니다]
echo     -^> 위 폴더 안의 '로이창고_수집기' 폴더 선택
echo.
echo   * 예전 폴더(다운로드\로이창고)에서 불러와 있던 확장은, 그 항목을 [삭제]하고
echo     위 폴더로 새로 [로드]해야 이번 업데이트가 적용됩니다.
echo.
echo   * 예전 폴더(다운로드\로이창고)는 확장을 새 폴더로 다시 불러온 뒤 지우셔도 됩니다.
echo     예전 폴더는 이제 쓰지 않습니다.
echo.
echo   * 앱 설정(Gemini API 키 등)이 안 보이면 [설정]에서 다시 넣으시면 됩니다.
echo     입력해 둔 내용은 크롬 안에 저장되므로 폴더를 옮겨도 대개 그대로 남습니다.
echo.
echo   * 다음부터는 바탕화면의 [로이창고] 아이콘을 누르면 바로 열립니다.
echo.
echo   * 바탕화면 아이콘이 예전 폴더를 가리키고 있으면 F5^(새로 고침^)를 한 번 누르세요.
echo.

if defined CHROME (
  echo   로이창고를 크롬으로 엽니다...
  start "" "%CHROME%" "%DEST%\로이창고.html"
) else (
  echo   로이창고를 엽니다... ^(크롬이 없어 기본 브라우저로 엽니다^)
  start "" "%DEST%\로이창고.html"
)

echo   창을 닫으셔도 됩니다.
timeout /t 8 >nul
exit /b 0

:NODEST
echo.
echo ============================================================
echo    설치 폴더를 만들지 못했습니다
echo ============================================================
echo.
echo   - C:\로이창고 와 %USERPROFILE%\로이창고 폴더 모두 쓸 수 없습니다.
echo   - 윈도우 보안 프로그램이 폴더 만들기를 막고 있는지 확인해 주세요.
echo   - 계속 안 되면 로이에게 이 화면을 보여 주세요.
echo.
pause
exit /b 1

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

:WRITETEST
rem %1 폴더에 작은 파일을 하나 써 보고 지웁니다. 쓸 수 있으면 errorlevel 0.
%PS% "$d='%~1'; try{ $t=Join-Path $d ('wo'+[string](Get-Random)+'.tmp'); Set-Content -LiteralPath $t -Value 'x' -ErrorAction Stop; Remove-Item -LiteralPath $t -Force -ErrorAction Stop; exit 0 } catch { exit 1 }"
exit /b %errorlevel%
