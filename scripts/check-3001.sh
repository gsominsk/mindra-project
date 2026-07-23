#!/bin/bash
# Быстрая проверка :3001 пока next start suspended
echo "=== 1. jobs (next start должен быть Stopped) ==="
jobs
echo
echo "=== 2. ps — процесс жив? ==="
ps -o pid,stat,rss,command | grep -E "next|node" | grep -v grep | head
echo
echo "=== 3. curl :3001/login (с таймаутом 5 сек) ==="
curl -sS --max-time 5 -o /dev/null -w "HTTP %{http_code}, size %{size_download}, time %{time_total}s\n" http://localhost:3001/login
echo
echo "=== 4. curl :3001/ (главная) ==="
curl -sS --max-time 5 -o /dev/null -w "HTTP %{http_code}, size %{size_download}\n" http://localhost:3001/
echo
echo "=== 5. Если 200 — запустить next start в фон ==="
bg %1 2>/dev/null
sleep 2
echo
echo "=== 6. Проверить что работает в фоне ==="
jobs
ps -o pid,stat,rss,command | grep -E "next start" | grep -v grep
echo
echo "=== 7. Финальный curl ==="
curl -sS --max-time 5 -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/login