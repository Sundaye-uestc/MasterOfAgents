@echo off
REM Wrapper for 7za.exe that removes the -snld flag to avoid symlink errors on Windows
setlocal enabledelayedexpansion
set args=
:loop
if "%1"=="" goto run
if "%1"=="-snld" (
    shift
    goto loop
)
set args=!args! "%1"
shift
goto loop
:run
"D:\Projects\MasterOfAgents\AgentHub\node_modules\.pnpm\7zip-bin@5.2.0\node_modules\7zip-bin\win\x64\7za.exe" !args!
exit /b %errorlevel%
