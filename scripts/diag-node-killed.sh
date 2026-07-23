#!/bin/bash
# Диагностика: почему node Killed на ukraine.com.ua shared hosting
# Собираем ВСЕ доступные факты

echo "========================================"
echo "DIAG: why node gets Killed on this hosting"
echo "========================================"
echo "Date: $(date)"
echo "User: $(whoami)  UID: $(id -u)  GID: $(id -g)"
echo

echo "=== 1. ulimit -a (shell limits) ==="
ulimit -a
echo

echo "=== 2. /proc/self/limits (real kernel limits) ==="
cat /proc/self/limits 2>/dev/null | head -20
echo

echo "=== 3. /proc/self/status — memory of THIS shell ==="
cat /proc/self/status 2>/dev/null | grep -iE "Vm|Threads|Max|Limit"
echo

echo "=== 4. /proc/self/cgroup — LVE container info ==="
cat /proc/self/cgroup 2>/dev/null
echo

echo "=== 5. LVE limits ==="
cat /proc/user_beancounters 2>/dev/null | head -20 || echo "(no /proc/user_beancounters)"
command -v lveinfo >/dev/null 2>&1 && lveinfo 2>&1 | head -10 || echo "(lveinfo not available)"
command -v lvectl >/dev/null 2>&1 && lvectl list-user $(whoami) 2>&1 | head || echo "(lvectl not available)"
echo

echo "=== 6. /proc/meminfo — host memory ==="
head -15 /proc/meminfo 2>/dev/null
echo

echo "=== 7. free -m ==="
free -m 2>/dev/null
echo

echo "=== 8. oom_score ==="
cat /proc/self/oom_score_adj 2>/dev/null
cat /proc/self/oom_score 2>/dev/null
echo

echo "=== 9. CageFS ==="
ls -la ~/.cagefs/ 2>/dev/null | head -5
echo

echo "=== 10. dmesg (may lack perms) ==="
dmesg 2>&1 | grep -iE "kill|oom|memory|ct603752" | tail -10 || echo "(dmesg not available)"
echo

echo "=== 11. mem probe — node с трассировкой ДО kill ==="
cat > /tmp/mem-probe.js << 'PROBE'
const fs = require('fs');
function logMem(label) {
  const m = process.memoryUsage();
  const line = `[${new Date().toISOString()}] ${label}: RSS=${Math.round(m.rss/1024)}KB heapUsed=${Math.round(m.heapUsed/1024)}KB heapTotal=${Math.round(m.heapTotal/1024)}KB external=${Math.round(m.external/1024)}KB`;
  console.log(line);
  try { fs.appendFileSync('/tmp/node-mem-trace.log', line + '\n'); } catch(e) {}
}
logMem('startup');
const http = require('http');
const server = http.createServer((req, res) => {
  logMem('request ' + req.url);
  res.writeHead(200);
  res.end('OK ' + process.pid);
});
server.listen(3000, () => {
  logMem('listening on :3000');
  setInterval(() => logMem('interval'), 200);
});
PROBE

rm -f /tmp/node-mem-trace.log
echo "Starting node with mem probe (timeout 5 sec)..."
timeout 5 node /tmp/mem-probe.js 2>&1 || echo "(node exited with code $?)"
echo
echo "=== 12. Memory trace (what node logged BEFORE kill) ==="
cat /tmp/node-mem-trace.log 2>/dev/null || echo "(node logged nothing — killed instantly)"
echo
echo "=== 13. cgroup memory limits ==="
cat /sys/fs/cgroup/memory/$(cat /proc/self/cgroup | grep memory | cut -d: -f3)/memory.limit_in_bytes 2>/dev/null || echo "(no cgroup memory limit readable)"
find /sys/fs/cgroup/memory -name "memory.limit_in_bytes" -readable 2>/dev/null | head -3 | while read f; do echo "$f: $(cat $f)"; done
echo
echo "=== 14. /proc/version — kernel ==="
cat /proc/version 2>/dev/null
echo
echo "========================================"
echo "END DIAG — send all output back"