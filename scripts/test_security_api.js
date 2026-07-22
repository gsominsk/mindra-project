const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
    console.log('==================================================');
    console.log('🚀 RUNNING AUTOMATED SECURITY & API TESTS');
    console.log('==================================================\n');

    let cookieHeader = '';
    let passedCount = 0;
    let totalCount = 0;

    function assert(condition, message) {
        totalCount++;
        if (condition) {
            console.log(`✅ PASSED: ${message}`);
            passedCount++;
        } else {
            console.error(`❌ FAILED: ${message}`);
        }
    }

    try {
        // Test 1: Redirect unauthenticated page request
        const res1 = await fetch(`${BASE_URL}/party-prompts`, { redirect: 'manual' });
        assert(
            res1.status === 307 || res1.status === 302,
            `Unauthenticated /party-prompts redirects (status: ${res1.status})`
        );
        const loc1 = res1.headers.get('location');
        assert(
            loc1 && loc1.includes('/login?from='),
            `Redirect URL points to /login with 'from' parameter: ${loc1}`
        );

        // Test 2: Unauthenticated Upload API call
        const res2 = await fetch(`${BASE_URL}/party-prompts/api/upload`, { method: 'POST' });
        assert(
            res2.status === 401,
            `Unauthenticated upload API request returns 401 (status: ${res2.status})`
        );

        // Test 3: Unauthenticated Generate API call
        const res3 = await fetch(`${BASE_URL}/party-prompts/api/generate`, { method: 'POST' });
        assert(
            res3.status === 401,
            `Unauthenticated generate API request returns 401 (status: ${res3.status})`
        );

        // Test 4: Auth Login invalid password
        const res4 = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'wrong-password-12345' }),
        });
        assert(
            res4.status === 401,
            `Login with invalid password returns 401 (status: ${res4.status})`
        );

        // Test 5: Login with party prompts credentials or test admin hash
        let envUser = process.env.PARTY_PROMPTS_USER || 'admin';
        let envPass = process.env.PARTY_PROMPTS_PASS || 'testpass';

        const envFilePath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envFilePath)) {
            const envContent = fs.readFileSync(envFilePath, 'utf8');
            const matchUser = envContent.match(/PARTY_PROMPTS_USER=(.*)/);
            const matchPass = envContent.match(/PARTY_PROMPTS_PASS=(.*)/);
            if (matchUser) envUser = matchUser[1].trim();
            if (matchPass) envPass = matchPass[1].trim();
        }

        const res5 = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: envUser, password: envPass }),
        });

        if (res5.ok) {
            assert(true, `Login with configured credentials succeeded (status: ${res5.status})`);
            const setCookie = res5.headers.get('set-cookie');
            if (setCookie) {
                cookieHeader = setCookie.split(';')[0];
                assert(cookieHeader.includes('admin_session='), `Received valid session cookie: ${cookieHeader}`);
            }
        } else {
            console.log(`ℹ️ Auth note: Default credentials not set in .env. Testing remaining validation logic...`);
        }

        // Test 6: File upload validation with mock boundary (Invalid File Format)
        if (cookieHeader) {
            const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
            const bodyTxt = 
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
                `Content-Type: text/plain\r\n\r\n` +
                `Hello world\r\n` +
                `--${boundary}--\r\n`;

            const res6 = await fetch(`${BASE_URL}/party-prompts/api/upload`, {
                method: 'POST',
                headers: {
                    'Cookie': cookieHeader,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                body: bodyTxt,
            });
            assert(
                res6.status === 400,
                `Uploading non-image file (.txt) returns 400 Bad Request (status: ${res6.status})`
            );

            // Test 7: Upload valid PNG image
            const pngHeaderBytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
            const headerPart = 
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="file"; filename="test_sample.png"\r\n` +
                `Content-Type: image/png\r\n\r\n`;
            const footerPart = `\r\n--${boundary}--\r\n`;
            
            const fullBody = Buffer.concat([
                Buffer.from(headerPart, 'utf8'),
                pngHeaderBytes,
                Buffer.from(footerPart, 'utf8')
            ]);

            const res7 = await fetch(`${BASE_URL}/party-prompts/api/upload`, {
                method: 'POST',
                headers: {
                    'Cookie': cookieHeader,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                body: fullBody,
            });

            if (res7.ok) {
                const data7 = await res7.json();
                assert(
                    data7.url && data7.url.startsWith('/uploads/party-prompts/'),
                    `Valid image upload succeeded: ${data7.url}`
                );
            } else {
                console.error(`Upload valid image failed with status ${res7.status}`);
            }

            // Test 8: Generate API call validation
            const res8 = await fetch(`${BASE_URL}/party-prompts/api/generate`, {
                method: 'POST',
                headers: {
                    'Cookie': cookieHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: 'test prompt' }),
            });
            assert(
                res8.status === 400 || res8.status === 200,
                `Generate API call handled on server safely (status: ${res8.status})`
            );
        }

    } catch (err) {
        console.error('Test execution error:', err);
    }

    console.log('\n==================================================');
    console.log(`📊 TEST SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED`);
    console.log('==================================================\n');
}

runTests();
