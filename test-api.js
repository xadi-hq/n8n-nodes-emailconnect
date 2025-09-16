#!/usr/bin/env node

/**
 * Simple test script to verify EmailConnect API endpoints
 * Usage: node test-api.js YOUR_API_KEY
 */

const https = require('https');

function makeApiRequest(apiKey, path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'app.emailconnect.eu',
            port: 443,
            path: path,
            method: 'GET',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
                'User-Agent': 'n8n-emailconnect-test/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: jsonData
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data,
                        parseError: e.message
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function testEmailConnectApi(apiKey) {
    console.log('🔍 Testing EmailConnect API...');
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT PROVIDED');
    console.log('');

    if (!apiKey) {
        console.error('❌ Please provide an API key as the first argument');
        console.log('Usage: node test-api.js YOUR_API_KEY');
        process.exit(1);
    }

    try {
        // Test 1: Get domains
        console.log('📋 Testing GET /api/domains...');
        const domainsResponse = await makeApiRequest(apiKey, '/api/domains');
        console.log('Status:', domainsResponse.statusCode);
        console.log('Response:', JSON.stringify(domainsResponse.data, null, 2));
        console.log('');

        if (domainsResponse.statusCode === 200 && Array.isArray(domainsResponse.data)) {
            console.log(`✅ Domains endpoint working! Found ${domainsResponse.data.length} domain(s)`);
            
            // Test 2: Get aliases for first domain (if any)
            if (domainsResponse.data.length > 0) {
                const firstDomain = domainsResponse.data[0];
                console.log(`📧 Testing GET /api/aliases?domainId=${firstDomain.id}...`);
                
                const aliasesResponse = await makeApiRequest(apiKey, `/api/aliases?domainId=${firstDomain.id}`);
                console.log('Status:', aliasesResponse.statusCode);
                console.log('Response:', JSON.stringify(aliasesResponse.data, null, 2));
                console.log('');
                
                if (aliasesResponse.statusCode === 200 && Array.isArray(aliasesResponse.data)) {
                    console.log(`✅ Aliases endpoint working! Found ${aliasesResponse.data.length} alias(es) for domain ${firstDomain.domain}`);
                } else {
                    console.log('❌ Aliases endpoint failed or returned unexpected data');
                }
            } else {
                console.log('⚠️ No domains found, skipping aliases test');
            }
        } else {
            console.log('❌ Domains endpoint failed or returned unexpected data');
        }

        // Test 3: Get webhooks
        console.log('🔗 Testing GET /api/webhooks...');
        const webhooksResponse = await makeApiRequest(apiKey, '/api/webhooks');
        console.log('Status:', webhooksResponse.statusCode);
        console.log('Response:', JSON.stringify(webhooksResponse.data, null, 2));
        console.log('');

        if (webhooksResponse.statusCode === 200) {
            console.log('✅ Webhooks endpoint working!');
        } else {
            console.log('❌ Webhooks endpoint failed');
        }

    } catch (error) {
        console.error('❌ API test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
const apiKey = process.argv[2];
testEmailConnectApi(apiKey);
