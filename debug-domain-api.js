#!/usr/bin/env node

/**
 * Debug script to test EmailConnect domain API responses
 * Usage: node debug-domain-api.js YOUR_API_KEY [DOMAIN_ID]
 */

const https = require('https');

async function makeRequest(path, apiKey) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'emailconnect.eu',
            port: 443,
            path: path,
            method: 'GET',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function debugDomainApi(apiKey, domainId) {
    console.log('🔍 Debugging EmailConnect Domain API...');
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT PROVIDED');
    console.log('Domain ID:', domainId || 'NOT PROVIDED');
    console.log('');

    if (!apiKey) {
        console.error('❌ Please provide an API key as the first argument');
        console.log('Usage: node debug-domain-api.js YOUR_API_KEY [DOMAIN_ID]');
        process.exit(1);
    }

    try {
        // Test 1: Get all domains
        console.log('📋 Testing GET /api/domains...');
        const domainsResponse = await makeRequest('/api/domains', apiKey);
        console.log('Status:', domainsResponse.status);
        console.log('Response:', JSON.stringify(domainsResponse.data, null, 2));
        console.log('');

        // Extract first domain ID if not provided
        let testDomainId = domainId;
        if (!testDomainId && domainsResponse.data && domainsResponse.data.domains && domainsResponse.data.domains.length > 0) {
            testDomainId = domainsResponse.data.domains[0].id;
            console.log('🎯 Using first domain ID for testing:', testDomainId);
            console.log('');
        }

        if (testDomainId) {
            // Test 2: Get specific domain
            console.log(`📋 Testing GET /api/domains/${testDomainId}...`);
            const domainResponse = await makeRequest(`/api/domains/${testDomainId}`, apiKey);
            console.log('Status:', domainResponse.status);
            console.log('Response:', JSON.stringify(domainResponse.data, null, 2));
            console.log('');

            // Analyze the response structure
            if (domainResponse.data) {
                console.log('🔍 Analysis:');
                console.log('- Response type:', typeof domainResponse.data);
                console.log('- Has domainName field:', 'domainName' in domainResponse.data);
                console.log('- Has name field:', 'name' in domainResponse.data);
                console.log('- All keys:', Object.keys(domainResponse.data));
                
                if (domainResponse.data.domainName) {
                    console.log('✅ domainName found:', domainResponse.data.domainName);
                } else if (domainResponse.data.name) {
                    console.log('⚠️  Found "name" instead of "domainName":', domainResponse.data.name);
                } else {
                    console.log('❌ Neither domainName nor name found in response');
                }
            }
        } else {
            console.log('⚠️  No domain ID available for single domain test');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the debug script
const apiKey = process.argv[2];
const domainId = process.argv[3];
debugDomainApi(apiKey, domainId);
