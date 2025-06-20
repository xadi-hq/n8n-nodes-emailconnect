/**
 * Backend API Integration Tests
 * Tests the actual EmailConnect backend API endpoints
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'ak_ce7e58d4975b3a68a7a1aeaa2535f6eb431ae755e8912dd8f51240bf3efa63e6';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  }
});

describe('EmailConnect Backend API Tests', () => {
  let testDomainId;
  let testWebhookId;
  let testAliasId;

  beforeAll(async () => {
    // Get available domains
    try {
      const response = await apiClient.get('/api/domains');
      if (response.data.domains && response.data.domains.length > 0) {
        testDomainId = response.data.domains[0].id;
        console.log('Using test domain ID:', testDomainId);
      }
    } catch (error) {
      console.error('Failed to get domains:', error.response?.data || error.message);
    }
  });

  describe('Domain API', () => {
    test('should get all domains', async () => {
      const response = await apiClient.get('/api/domains');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('domains');
      expect(Array.isArray(response.data.domains)).toBe(true);
      expect(response.data).toHaveProperty('total');
    });

    test('should get single domain if domain exists', async () => {
      if (!testDomainId) {
        console.log('Skipping single domain test - no domains available');
        return;
      }

      const response = await apiClient.get(`/api/domains/${testDomainId}`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', testDomainId);
      expect(response.data).toHaveProperty('domain');
    });
  });

  describe('Aliases API', () => {
    test('should get aliases for domain', async () => {
      if (!testDomainId) {
        console.log('Skipping aliases test - no domains available');
        return;
      }

      const response = await apiClient.get(`/api/aliases?domainId=${testDomainId}`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('aliases');
      expect(Array.isArray(response.data.aliases)).toBe(true);
      expect(response.data).toHaveProperty('total');
    });
  });

  describe('Webhook-Alias Creation API', () => {
    test('should create specific alias for verified domain', async () => {
      if (!testDomainId) {
        console.log('Skipping webhook-alias test - no domains available');
        return;
      }

      const webhookAliasData = {
        domainId: testDomainId,
        webhookUrl: `https://webhook.site/test-specific-alias-${Date.now()}`,
        webhookName: 'Test Specific Alias Webhook',
        webhookDescription: 'Testing specific alias creation',
        aliasType: 'specific',
        localPart: `testspecific${Date.now()}`,
        autoVerify: true
      };

      const response = await apiClient.post('/api/webhooks/alias', webhookAliasData);

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data).toHaveProperty('webhook');
      expect(response.data).toHaveProperty('alias');
      expect(response.data.message).toContain('Created alias');
    });

    test('should reject creating duplicate catch-all alias', async () => {
      if (!testDomainId) {
        console.log('Skipping duplicate catch-all test - no domains available');
        return;
      }

      const webhookAliasData = {
        domainId: testDomainId,
        webhookUrl: 'https://webhook.site/test-duplicate-catchall',
        webhookName: 'Test Duplicate Catch-All Webhook',
        webhookDescription: 'Testing duplicate catch-all creation',
        aliasType: 'catchall',
        syncWithDomain: true,
        autoVerify: true
      };

      try {
        await apiClient.post('/api/webhooks/alias', webhookAliasData);
        // If we get here, the test should fail because catch-all already exists
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(409);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toContain('already exists');
      }
    });

    test('should validate required fields', async () => {
      const invalidData = {
        domainId: testDomainId,
        webhookUrl: 'https://webhook.site/test-validation',
        // Missing required fields like webhookName, aliasType
      };

      try {
        await apiClient.post('/api/webhooks/alias', invalidData);
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toBeDefined();
      }
    });

    test('should validate localPart for specific aliases', async () => {
      if (!testDomainId) {
        console.log('Skipping localPart validation test - no domains available');
        return;
      }

      const invalidData = {
        domainId: testDomainId,
        webhookUrl: 'https://webhook.site/test-localpart-validation',
        webhookName: 'Test LocalPart Validation',
        aliasType: 'specific',
        // Missing localPart for specific alias
        autoVerify: true
      };

      try {
        await apiClient.post('/api/webhooks/alias', invalidData);
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toContain('localPart');
      }
    });
  });

  describe('Webhooks API', () => {
    test('should get all webhooks', async () => {
      const response = await apiClient.get('/api/webhooks');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('webhooks');
      expect(Array.isArray(response.data.webhooks)).toBe(true);
      expect(response.data).toHaveProperty('total');
    });

    test('should create webhook', async () => {
      const webhookData = {
        name: 'Test Webhook Creation',
        url: 'https://webhook.site/test-webhook-creation',
        description: 'Testing webhook creation API'
      };

      const response = await apiClient.post('/api/webhooks', webhookData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('webhook');
      expect(response.data.webhook).toHaveProperty('id');
      expect(response.data.webhook.name).toBe(webhookData.name);
      expect(response.data.webhook.url).toBe(webhookData.url);
      
      // Store for cleanup
      testWebhookId = response.data.webhook.id;
    });
  });

  afterAll(async () => {
    // Cleanup created webhook
    if (testWebhookId) {
      try {
        await apiClient.delete(`/api/webhooks/${testWebhookId}`);
        console.log('Cleaned up test webhook:', testWebhookId);
      } catch (error) {
        console.warn('Failed to cleanup webhook:', error.response?.data || error.message);
      }
    }
  });
});
