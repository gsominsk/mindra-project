#!/bin/bash
# ТЕСТ: next start сразу в фон, БЕЗ Ctrl+Z, БЕЗ timeout
# Цель: проверить отвечает ли :3001 когда next start бежит в фоне

cd ~/mindra-project

echo "=== 1. Убить всё старое на :3001 ==="
pkill -f "next start" 2>/dev/null
sleep 1

echo "=== 2. Запустить next start :3001 напрямую в фон (nohup, без timeout) ==="
nohup node_modules/.bin/next start -p 3001 > ~/next-3001.log 2>&1 &
PID=$!
echo "PID: $PID"

echo "=== 3. Ждать 4 сек ==="
sleep 4

echo "=== 4. Процесс жив? ==="
if kill -0 $PID 2>/dev/null; then
  echo "✅ процесс жив (PID $PID)"
  ps -o pid,stat,rss,command -p $PID
else
  echo "🔴 процесс УМЕР"
  wait $PID 2>/dev/null
  echo "exit code: $?"
fi

echo
echo "=== 5. Лог ==="
cat ~/next-3001.log

echo
echo "=== 6. curl :3001/login ==="
curl -sS --max-time 5 -o /dev/null -w "HTTP %{http_code}, size %{size_download}b, time %{time_total}s\n" http://localhost:3001/login

echo
echo "=== 7. curl :3001/ ==="
curl -sS --max-time 5 -o /dev/null -w "HTTP %{http_code}, size %{size_download}b\n" http://localhost:3001/

echo
echo "=== 8. Процесс ещё жив? ==="
if kill -0 $PID 2>/dev/null; then
  echo "✅ процесс жив после curl"
  ps -o pid,stat,rss,command -p $PID
else
  echo "🔴 процесс умер после curl"
fi

echo
echo "=== 9. Если жив — подождать ещё 10 сек, проверить что не Killed ==="
sleep 10
if kill -0 $PID 2>/dev/null; then
  echo "✅ процесс жив через 14 сек после старта"
  ps -o pid,stat,rss -p $PID
else
  echo "🔴 процесс был Killed"
  echo "log tail:"
  tail -5 ~/next-3001.log
fi

echo
echo "=== 10. cleanup ==="
kill $PID 2>/dev/null
echo "done"