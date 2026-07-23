#!/bin/bash
# DIAG v2: точечно узнаём LVE cgroup лимиты + тест без listen
# Цель: понять что убивает node через 3 сек при RSS 46МБ

echo "========================================"
echo "DIAG v2: LVE cgroup limits + no-listen test"
echo "========================================"
echo

echo "=== 1. cgroup пути для этого процесса ==="
cat /proc/self/cgroup
echo

echo "=== 2. MEMORY cgroup limits (/sys/fs/cgroup/memory/lve2381/) ==="
CGMEM="/sys/fs/cgroup/memory/lve2381"
echo "Path: $CGMEM"
echo "--- memory.limit_in_bytes (PMEM hard limit): ---"
cat "$CGMEM/memory.limit_in_bytes" 2>/dev/null || echo "(нет прав)"
echo "--- memory.memsw.limit_in_bytes (VMEM limit): ---"
cat "$CGMEM/memory.memsw.limit_in_bytes" 2>/dev/null || echo "(нет прав)"
echo "--- memory.usage_in_bytes (текущее потребление): ---"
cat "$CGMEM/memory.usage_in_bytes" 2>/dev/null || echo "(нет прав)"
echo "--- memory.max_usage_in_bytes (пик): ---"
cat "$CGMEM/memory.max_usage_in_bytes" 2>/dev/null || echo "(нет прав)"
echo "--- memory.failcnt (счётчик превышений): ---"
cat "$CGMEM/memory.failcnt" 2>/dev/null || echo "(нет прав)"
echo

echo "=== 3. CPU cgroup limits (/sys/fs/cgroup/cpu,cpuacct/lve2381/) ==="
CGCPU="/sys/fs/cgroup/cpu,cpuacct/lve2381"
echo "--- cpu.cfs_quota_us (-quota, -1 = нет лимита): ---"
cat "$CGCPU/cpu.cfs_quota_us" 2>/dev/null || echo "(нет прав)"
echo "--- cpu.cfs_period_us: ---"
cat "$CGCPU/cpu.cfs_period_us" 2>/dev/null || echo "(нет прав)"
echo "--- cpuacct.usage (сколько CPU-нс уже потреблено): ---"
cat "$CGCPU/cpuacct.usage" 2>/dev/null || echo "(нет прав)"
echo

echo "=== 4. PIDS cgroup limits (/sys/fs/cgroup/pids/lve2381/) ==="
CGPIDS="/sys/fs/cgroup/pids/lve2381"
echo "--- pids.max (nPROC лимит): ---"
cat "$CGPIDS/pids.max" 2>/dev/null || echo "(нет прав)"
echo "--- pids.current (текущее число процессов): ---"
cat "$CGPIDS/pids.current" 2>/dev/null || echo "(нет прав)"
echo

echo "=== 5. IO cgroup limits (/sys/fs/cgroup/blkio/lve2381/) ==="
CGBLKIO="/sys/fs/cgroup/blkio/lve2381"
ls "$CGBLKIO" 2>/dev/null | head -10 || echo "(нет прав)"
echo

echo "=== 6. ТЕСТ A: node БЕЗ listen (просто setInterval) ==="
cat > /tmp/test-nolisten.js << 'PROBE'
const fs = require('fs');
function log(label) {
  const m = process.memoryUsage();
  const cpu = process.cpuUsage();
  const line = `[${new Date().toISOString()}] ${label}: RSS=${Math.round(m.rss/1024)}KB heap=${Math.round(m.heapUsed/1024)}KB cpuUser=${Math.round(cpu.user/1000)}ms cpuSys=${Math.round(cpu.system/1000)}ms`;
  console.log(line);
  try { fs.appendFileSync('/tmp/test-nolisten.log', line + '\n'); } catch(e) {}
}
log('startup — NO listen, NO http');
setInterval(() => log('idle'), 200);
PROBE

rm -f /tmp/test-nolisten.log
echo "Running node WITHOUT http server (timeout 10 sec)..."
timeout 10 node /tmp/test-nolisten.js 2>&1
echo "exit code: $?"
echo
echo "--- trace что успел записать: ---"
cat /tmp/test-nolisten.log 2>/dev/null || echo "(ничего)"
echo

echo "=== 7. ТЕСТ B: node ТОЛЬКО listen, без setInterval ==="
cat > /tmp/test-listen-only.js << 'PROBE'
const fs = require('fs');
const http = require('http');
function log(label) {
  const m = process.memoryUsage();
  const cpu = process.cpuUsage();
  const line = `[${new Date().toISOString()}] ${label}: RSS=${Math.round(m.rss/1024)}KB cpuUser=${Math.round(cpu.user/1000)}ms`;
  console.log(line);
  try { fs.appendFileSync('/tmp/test-listen.log', line + '\n'); } catch(e) {}
}
log('before listen');
const server = http.createServer((req, res) => { res.end('ok'); });
server.listen(3001, () => log('listening :3001 — NO interval'));
// разовый лог через 5 сек, без setInterval
setTimeout(() => log('after 5 sec'), 5000);
setTimeout(() => log('after 8 sec'), 8000);
PROBE

rm -f /tmp/test-listen.log
echo "Running node with http listen on :3001 (timeout 15 sec)..."
timeout 15 node /tmp/test-listen-only.js 2>&1
echo "exit code: $?"
echo
echo "--- trace: ---"
cat /tmp/test-listen.log 2>/dev/null || echo "(ничего)"
echo

echo "========================================"
echo "END DIAG v2"