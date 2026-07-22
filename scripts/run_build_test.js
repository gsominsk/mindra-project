const { execSync } = require('child_process');

console.log('==================================================');
console.log('🏗️ EXECUTING NEXT.JS PRODUCTION BUILD TEST');
console.log('==================================================\n');

try {
  const output = execSync('node node_modules/next/dist/bin/next build', {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✅ BUILD SUCCESSFUL!');
  console.log(output);
} catch (error) {
  console.error('❌ BUILD FAILED WITH EXIT CODE:', error.status);
  console.error('\n--- STDOUT ---');
  console.error(error.stdout);
  console.error('\n--- STDERR ---');
  console.error(error.stderr);
  process.exit(1);
}
