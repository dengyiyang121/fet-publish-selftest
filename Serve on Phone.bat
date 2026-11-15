@echo off
title Functional Ear Trainer - Phone Server
cd /d "%~dp0"
echo Starting the Functional Ear Trainer phone server...
echo.
node serve.js
echo.
echo Server stopped.
pause
