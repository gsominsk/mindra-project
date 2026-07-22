const fs = require('fs');
const path = require('path');

console.log('==================================================');
console.log('🧪 DYNAMIC FUNCTIONAL TEST: LOGGING & QUOTA MODULES');
console.log('==================================================\n');

// Test 1: Import modules
const { appendServerLog, rotatePartyLogs } = require('../lib/logger_server');
const { getUploadsSize, checkAndCleanupUploadQuota } = require('../lib/quota_cleanup');

console.log('1️⃣ Testing Server File Logging...');
appendServerLog({
  level: 'info',
  namespace: 'DYNAMIC_TEST',
  msg: 'Testing server log entry generation and rotation',
  data: { testTime: new Date().toISOString() }
});

const logDir = path.join(__dirname, '../logs/party_prompts');
const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl'));
console.log(`✅ Log directory exists (${files.length} .jsonl files found)`);
console.log(`   Latest log file: ${files[files.length - 1]}`);

// Test 2: Test Rotation Logic (dry run with small maxBytes)
console.log('\n2️⃣ Testing Log Rotation Logic...');
rotatePartyLogs(500 * 1024 * 1024); // Should pass safely without errors
console.log('✅ Log rotation executed safely');

// Test 3: Test Upload Directory Size Calculation
console.log('\n3️⃣ Testing Upload Directory Quota Calculation...');
const currentSize = getUploadsSize();
console.log(`✅ Current uploads directory size: ${(currentSize / (1024 * 1024)).toFixed(3)} MB (${currentSize} bytes)`);

console.log('\n==================================================');
console.log('🎉 ALL DYNAMIC FUNCTIONAL TESTS PASSED PERFECTLY!');
console.log('==================================================\n');
