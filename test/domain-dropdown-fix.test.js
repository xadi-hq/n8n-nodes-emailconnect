/**
 * Test for domain dropdown fix
 * Verifies that domain names are displayed correctly in dropdown
 */

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

// Mock the emailConnectApiRequest function
jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn()
}));

const { emailConnectApiRequest } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

describe('Domain Dropdown Fix', () => {
  let triggerNode;
  let mockContext;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
    emailConnectApiRequest.mockReset();
    
    mockContext = {
      getCredentials: jest.fn().mockResolvedValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000'
      }),
      helpers: {
        httpRequest: jest.fn()
      }
    };
  });

  test('should correctly format domain names in dropdown options', async () => {
    // Mock API response with actual structure from backend
    const mockApiResponse = {
      domains: [
        {
          id: 'cmc5860m40004axgd6cv4kim0',
          domain: 'in.xadi.nl',
          webhook: {
            id: 'cmc585yv10002axgdpxhhq4nm',
            name: '474a',
            url: 'https://webhook.site/3e8938f6-c210-4a90-9b7e-8a902b9e474a',
            verified: true
          },
          active: true,
          isVerified: true,
          verificationStatus: 'VERIFIED'
        }
      ],
      total: 1
    };

    emailConnectApiRequest.mockResolvedValueOnce(mockApiResponse);

    const result = await triggerNode.methods.loadOptions.getDomains.call(mockContext);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'in.xadi.nl (cmc5860m40004axgd6cv4kim0)',
      value: 'cmc5860m40004axgd6cv4kim0'
    });

    // Verify the name doesn't contain 'undefined'
    expect(result[0].name).not.toContain('undefined');
    expect(result[0].name).toContain('in.xadi.nl');
    expect(result[0].name).toContain('cmc5860m40004axgd6cv4kim0');
  });

  test('should handle multiple domains correctly', async () => {
    const mockApiResponse = {
      domains: [
        {
          id: 'domain1',
          domain: 'example1.com',
          active: true,
          isVerified: true
        },
        {
          id: 'domain2', 
          domain: 'example2.com',
          active: true,
          isVerified: false
        }
      ],
      total: 2
    };

    emailConnectApiRequest.mockResolvedValueOnce(mockApiResponse);

    const result = await triggerNode.methods.loadOptions.getDomains.call(mockContext);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'example1.com (domain1)',
      value: 'domain1'
    });
    expect(result[1]).toEqual({
      name: 'example2.com (domain2)',
      value: 'domain2'
    });

    // Verify no 'undefined' in any names
    result.forEach(option => {
      expect(option.name).not.toContain('undefined');
    });
  });

  test('should handle empty domains array', async () => {
    const mockApiResponse = {
      domains: [],
      total: 0
    };

    emailConnectApiRequest.mockResolvedValueOnce(mockApiResponse);

    const result = await triggerNode.methods.loadOptions.getDomains.call(mockContext);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  test('should handle API errors gracefully', async () => {
    emailConnectApiRequest.mockRejectedValueOnce(new Error('API Error'));

    const result = await triggerNode.methods.loadOptions.getDomains.call(mockContext);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});
