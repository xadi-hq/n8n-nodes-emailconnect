/**
 * Tests the shared getDomainOptions loadOptions helper.
 * Drives the real function through a mocked httpRequest layer so it exercises
 * the actual response-unwrapping ({ domains: [...] }) and formatting logic.
 */

const { getDomainOptions } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

function makeContext(httpImpl) {
	return {
		getNode: jest.fn().mockReturnValue({ name: 'EmailConnect Trigger', type: 'emailConnectTrigger' }),
		helpers: {
			// The node authenticates via httpRequestWithAuthentication.
			httpRequestWithAuthentication: jest.fn().mockImplementation(httpImpl),
		},
		logger: {
			debug: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		},
	};
}

describe('getDomainOptions dropdown formatting', () => {
	test('formats a single domain as "domain (id)"', async () => {
		const ctx = makeContext(async () => ({
			domains: [{ id: 'cmc5860m40004axgd6cv4kim0', domain: 'in.xadi.nl', active: true }],
			total: 1,
		}));

		const result = await getDomainOptions.call(ctx);

		expect(result).toEqual([
			{ name: 'in.xadi.nl (cmc5860m40004axgd6cv4kim0)', value: 'cmc5860m40004axgd6cv4kim0' },
		]);
		expect(result[0].name).not.toContain('undefined');
	});

	test('formats multiple domains', async () => {
		const ctx = makeContext(async () => ({
			domains: [
				{ id: 'domain1', domain: 'example1.com' },
				{ id: 'domain2', domain: 'example2.com' },
			],
			total: 2,
		}));

		const result = await getDomainOptions.call(ctx);

		expect(result).toEqual([
			{ name: 'example1.com (domain1)', value: 'domain1' },
			{ name: 'example2.com (domain2)', value: 'domain2' },
		]);
		result.forEach((option) => expect(option.name).not.toContain('undefined'));
	});

	test('returns an empty array when there are no domains', async () => {
		const ctx = makeContext(async () => ({ domains: [], total: 0 }));
		const result = await getDomainOptions.call(ctx);
		expect(result).toEqual([]);
	});

	test('returns an empty array when the API errors', async () => {
		const ctx = makeContext(async () => {
			throw new Error('API Error');
		});
		const result = await getDomainOptions.call(ctx);
		expect(result).toEqual([]);
	});
});
