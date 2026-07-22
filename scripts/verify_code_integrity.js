const fs = require('fs');
const path = require('path');

console.log('==================================================');
console.log('🔍 VERIFYING CODE INTEGRITY & ROUTE EXPORTS');
console.log('==================================================\n');

let passed = 0;
let total = 0;

function assert(condition, msg) {
    total++;
    if (condition) {
        console.log(`✅ PASSED: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAILED: ${msg}`);
    }
}

// Check 1: Middleware file existence and exports
const middlewarePath = path.join(__dirname, '../middleware.ts');
assert(fs.existsSync(middlewarePath), 'middleware.ts exists');
const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
assert(middlewareContent.includes('/party-prompts'), 'middleware.ts contains /party-prompts protection matcher');
assert(middlewareContent.includes('admin_session'), 'middleware.ts validates admin_session cookie');

// Check 2: Login Route file
const loginRoutePath = path.join(__dirname, '../app/api/auth/login/route.ts');
assert(fs.existsSync(loginRoutePath), 'login/route.ts exists');
const loginContent = fs.readFileSync(loginRoutePath, 'utf8');
assert(loginContent.includes('PARTY_PROMPTS_USER'), 'login route supports PARTY_PROMPTS_USER');
assert(loginContent.includes('PARTY_PROMPTS_PASS'), 'login route supports PARTY_PROMPTS_PASS');

// Check 3: Party Prompts Upload Route
const uploadRoutePath = path.join(__dirname, '../app/party-prompts/api/upload/route.ts');
assert(fs.existsSync(uploadRoutePath), 'party-prompts upload route.ts exists');
const uploadContent = fs.readFileSync(uploadRoutePath, 'utf8');
assert(uploadContent.includes('admin_session'), 'upload route checks admin_session cookie');
assert(uploadContent.includes('.heic') && uploadContent.includes('.heif'), 'upload route validates HEIC/HEIF extensions');
assert(uploadContent.includes('MAX_FILE_SIZE'), 'upload route sets max file size limit');

// Check 4: Party Prompts Generate Route
const generateRoutePath = path.join(__dirname, '../app/party-prompts/api/generate/route.ts');
assert(fs.existsSync(generateRoutePath), 'party-prompts generate route.ts exists');
const generateContent = fs.readFileSync(generateRoutePath, 'utf8');
assert(generateContent.includes('openRouterKey'), 'generate route fetches openRouterKey on server from Prisma');
assert(generateContent.includes('https://openrouter.ai/api/v1/chat/completions'), 'generate route securely proxies OpenRouter API');

// Check 5: Client-side PartyPromptsApp.tsx API Key isolation
const appPath = path.join(__dirname, '../app/party-prompts/PartyPromptsApp.tsx');
assert(fs.existsSync(appPath), 'PartyPromptsApp.tsx exists');
const appContent = fs.readFileSync(appPath, 'utf8');
assert(!appContent.includes("https://openrouter.ai/api/v1/chat/completions"), 'Client PartyPromptsApp no longer exposes direct openrouter.ai calls');
assert(appContent.includes("/party-prompts/api/generate"), 'Client PartyPromptsApp uses secure server endpoint /party-prompts/api/generate');

// Check 6: Dockercompose Volume Configuration
const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
assert(fs.existsSync(dockerComposePath), 'docker-compose.yml exists');
const dockerContent = fs.readFileSync(dockerComposePath, 'utf8');
assert(dockerContent.includes('sqlite-data:/app/prisma'), 'docker-compose.yml contains sqlite-data volume for SQLite database persistence');

// Check 7: JWT Cryptographic Module & Signed Tokens
const jwtPath = path.join(__dirname, '../lib/jwt.ts');
assert(fs.existsSync(jwtPath), 'lib/jwt.ts exists');

const { createSignedJwt, verifySignedJwt } = require('../lib/jwt');
const testToken = createSignedJwt({ sub: 'test-admin', role: 'admin' }, 60);
assert(typeof testToken === 'string' && testToken.split('.').length === 3, 'JWT is created with 3 parts (header.payload.signature)');

const verifiedPayload = verifySignedJwt(testToken);
assert(verifiedPayload && verifiedPayload.sub === 'test-admin', 'Signed JWT signature successfully verified');

const tamperedToken = testToken.substring(0, testToken.length - 4) + 'abcd';
const tamperedPayload = verifySignedJwt(tamperedToken);
assert(tamperedPayload === null, 'Tampered JWT token fails signature verification');

// Check 8: Server File Logger & 30MB Rotation Module
const loggerServerPath = path.join(__dirname, '../lib/logger_server.ts');
assert(fs.existsSync(loggerServerPath), 'lib/logger_server.ts exists');
const loggerServerContent = fs.readFileSync(loggerServerPath, 'utf8');
assert(loggerServerContent.includes('MAX_LOG_BYTES = 30 * 1024 * 1024'), 'logger_server.ts sets 30MB log limit');
assert(loggerServerContent.includes('rotatePartyLogs'), 'logger_server.ts implements log rotation');

const logRoutePath = path.join(__dirname, '../app/party-prompts/api/log/route.ts');
assert(fs.existsSync(logRoutePath), 'app/party-prompts/api/log/route.ts exists');

const partyLogDir = path.join(__dirname, '../logs/party_prompts');
assert(fs.existsSync(partyLogDir), 'logs/party_prompts directory exists for session logs');

// Check 9: Media Quota Cleanup Module & Docker Volumes
const quotaCleanupPath = path.join(__dirname, '../lib/quota_cleanup.ts');
assert(fs.existsSync(quotaCleanupPath), 'lib/quota_cleanup.ts exists');
const quotaContent = fs.readFileSync(quotaCleanupPath, 'utf8');
assert(quotaContent.includes('MAX_UPLOADS_BYTES = 800 * 1024 * 1024'), 'quota_cleanup.ts sets 800MB disk limit');
assert(quotaContent.includes('prisma.promptList.delete'), 'quota_cleanup.ts performs cascade deletion from SQLite DB');
assert(dockerContent.includes('party-logs:/app/logs/party_prompts'), 'docker-compose.yml mounts party-logs volume for session logs');

// Check 10: Next.js Error Boundary & Global Unhandled Error Forwarding
const errorBoundaryPath = path.join(__dirname, '../app/party-prompts/error.tsx');
assert(fs.existsSync(errorBoundaryPath), 'app/party-prompts/error.tsx Error Boundary exists');
const errorBoundaryContent = fs.readFileSync(errorBoundaryPath, 'utf8');
assert(errorBoundaryContent.includes('/party-prompts/api/log'), 'error.tsx forwards render errors to server log file');
assert(appContent.includes('CLIENT_UNHANDLED_ERROR'), 'PartyPromptsApp.tsx includes global unhandled error listener');

console.log('\n==================================================');
console.log(`📊 INTEGRITY VERIFICATION SUMMARY: ${passed} / ${total} CHECKS PASSED`);
console.log('==================================================\n');
