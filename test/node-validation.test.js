/**
 * Basic validation tests for EmailConnect n8n nodes
 * These tests validate the node structure and basic functionality
 */

const { EmailConnect } = require('../dist/nodes/EmailConnect/EmailConnect.node.js');
const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

describe('EmailConnect Node Validation', () => {
  let emailConnectNode;
  let emailConnectTriggerNode;

  beforeEach(() => {
    emailConnectNode = new EmailConnect();
    emailConnectTriggerNode = new EmailConnectTrigger();
  });

  describe('EmailConnect Node Structure', () => {
    test('should have correct node description', () => {
      const description = emailConnectNode.description;
      
      expect(description.displayName).toBe('EmailConnect');
      expect(description.name).toBe('emailConnect');
      expect(description.group).toContain('transform');
      expect(description.version).toBe(1);
    });

    test('should have correct inputs and outputs', () => {
      const description = emailConnectNode.description;
      
      expect(description.inputs).toEqual(['main']);
      expect(description.outputs).toEqual(['main']);
    });

    test('should require EmailConnect API credentials', () => {
      const description = emailConnectNode.description;
      
      expect(description.credentials).toHaveLength(1);
      expect(description.credentials[0].name).toBe('emailConnectApi');
      expect(description.credentials[0].required).toBe(true);
    });

    test('should have domain, alias, and webhook resources', () => {
      const description = emailConnectNode.description;
      const resourceProperty = description.properties.find(p => p.name === 'resource');
      
      expect(resourceProperty).toBeDefined();
      expect(resourceProperty.options).toHaveLength(3);
      
      const resourceValues = resourceProperty.options.map(o => o.value);
      expect(resourceValues).toContain('domain');
      expect(resourceValues).toContain('alias');
      expect(resourceValues).toContain('webhook');
    });

    test('should have domain operations', () => {
      const description = emailConnectNode.description;
      const domainOperations = description.properties.find(p => 
        p.name === 'operation' && 
        p.displayOptions?.show?.resource?.includes('domain')
      );
      
      expect(domainOperations).toBeDefined();
      expect(domainOperations.options).toHaveLength(3);

      const operationValues = domainOperations.options.map(o => o.value);
      expect(operationValues).toContain('getAll');
      expect(operationValues).toContain('get');
      expect(operationValues).toContain('updateConfig');
    });

    test('should have alias operations', () => {
      const description = emailConnectNode.description;
      const aliasOperations = description.properties.find(p => 
        p.name === 'operation' && 
        p.displayOptions?.show?.resource?.includes('alias')
      );
      
      expect(aliasOperations).toBeDefined();
      expect(aliasOperations.options).toHaveLength(5);
      
      const operationValues = aliasOperations.options.map(o => o.value);
      expect(operationValues).toContain('getAll');
      expect(operationValues).toContain('get');
      expect(operationValues).toContain('create');
      expect(operationValues).toContain('update');
      expect(operationValues).toContain('delete');
    });

    test('alias create should require a webhook and not use destinationEmail', () => {
      const description = emailConnectNode.description;
      const properties = description.properties;

      // Regression guard: aliases route to a webhook (webhookId), never to a
      // forwarding "destinationEmail" (which the API has never supported).
      const destinationEmail = properties.find(p => p.name === 'destinationEmail');
      expect(destinationEmail).toBeUndefined();

      const aliasWebhookId = properties.find(p => p.name === 'aliasWebhookId');
      expect(aliasWebhookId).toBeDefined();
      expect(aliasWebhookId.required).toBe(true);
      expect(aliasWebhookId.typeOptions.loadOptionsMethod).toBe('getWebhooks');
      expect(aliasWebhookId.displayOptions.show.operation).toEqual(['create']);

      const localPart = properties.find(p => p.name === 'localPart');
      expect(localPart).toBeDefined();
      expect(localPart.required).toBe(true);
    });

    test('getAll operations expose Return All / Limit', () => {
      const properties = emailConnectNode.description.properties;
      const returnAll = properties.find(p => p.name === 'returnAll');
      const limit = properties.find(p => p.name === 'limit');

      expect(returnAll).toBeDefined();
      expect(returnAll.type).toBe('boolean');
      expect(returnAll.displayOptions.show.operation).toEqual(['getAll']);

      expect(limit).toBeDefined();
      expect(limit.type).toBe('number');
      expect(limit.displayOptions.show.returnAll).toEqual([false]);
    });

    test('should have webhook operations', () => {
      const description = emailConnectNode.description;
      const webhookOperations = description.properties.find(p =>
        p.name === 'operation' &&
        p.displayOptions?.show?.resource?.includes('webhook')
      );

      expect(webhookOperations).toBeDefined();
      expect(webhookOperations.options).toHaveLength(5);

      const operationValues = webhookOperations.options.map(o => o.value);
      expect(operationValues).toContain('getAll');
      expect(operationValues).toContain('get');
      expect(operationValues).toContain('create');
      expect(operationValues).toContain('update');
      expect(operationValues).toContain('delete');
    });
  });

  describe('EmailConnect Trigger Node Structure', () => {
    test('should have correct node description', () => {
      const description = emailConnectTriggerNode.description;
      
      expect(description.displayName).toBe('EmailConnect Trigger');
      expect(description.name).toBe('emailConnectTrigger');
      expect(description.group).toContain('trigger');
      expect(description.version).toBe(1);
    });

    test('should have correct inputs and outputs for trigger', () => {
      const description = emailConnectTriggerNode.description;
      
      expect(description.inputs).toEqual([]);
      expect(description.outputs).toEqual(['main']);
    });

    test('should require EmailConnect API credentials', () => {
      const description = emailConnectTriggerNode.description;
      
      expect(description.credentials).toHaveLength(1);
      expect(description.credentials[0].name).toBe('emailConnectApi');
      expect(description.credentials[0].required).toBe(true);
    });

    test('should have webhook configuration', () => {
      const description = emailConnectTriggerNode.description;
      
      expect(description.webhooks).toHaveLength(1);
      expect(description.webhooks[0].name).toBe('default');
      expect(description.webhooks[0].httpMethod).toBe('POST');
      expect(description.webhooks[0].path).toBe('emailconnect');
    });

    test('does not expose a non-functional event filter', () => {
      // The delivered payload carries no event "status" field, so an event
      // multiOptions selector cannot filter and was removed (it only ever
      // dropped emails). Guard against it being reintroduced.
      const description = emailConnectTriggerNode.description;
      const eventsProperty = description.properties.find(p => p.name === 'events');
      expect(eventsProperty).toBeUndefined();
    });

    test('should have domain and alias configuration', () => {
      const description = emailConnectTriggerNode.description;

      const domainId = description.properties.find(p => p.name === 'domainId');
      const aliasMode = description.properties.find(p => p.name === 'aliasMode');
      const aliasLocalPart = description.properties.find(p => p.name === 'aliasLocalPart');
      const webhookName = description.properties.find(p => p.name === 'webhookName');
      const webhookDescription = description.properties.find(p => p.name === 'webhookDescription');

      expect(domainId).toBeDefined();
      expect(domainId.type).toBe('options');
      expect(domainId.required).toBe(true);
      expect(domainId.typeOptions.loadOptionsMethod).toBe('getDomains');

      expect(aliasMode).toBeDefined();
      expect(aliasMode.type).toBe('options');
      expect(aliasMode.options).toHaveLength(2);
      expect(aliasMode.default).toBe('specific');
      const aliasModeValues = aliasMode.options.map(o => o.value);
      expect(aliasModeValues).toContain('catchall');
      expect(aliasModeValues).toContain('specific');

      expect(aliasLocalPart).toBeDefined();
      expect(aliasLocalPart.type).toBe('string');
      expect(aliasLocalPart.required).toBe(true);
      expect(aliasLocalPart.displayOptions.show.aliasMode).toContain('specific');

      expect(webhookName).toBeDefined();
      expect(webhookName.type).toBe('string');

      expect(webhookDescription).toBeDefined();
      expect(webhookDescription.type).toBe('string');
    });
  });

  describe('Node Methods', () => {
    test('EmailConnect node should have execute method', () => {
      expect(typeof emailConnectNode.execute).toBe('function');
    });

    test('EmailConnect trigger should have webhook method', () => {
      expect(typeof emailConnectTriggerNode.webhook).toBe('function');
    });

    test('EmailConnect trigger should have webhookMethods', () => {
      expect(emailConnectTriggerNode.webhookMethods).toBeDefined();
      expect(emailConnectTriggerNode.webhookMethods.default).toBeDefined();
      expect(typeof emailConnectTriggerNode.webhookMethods.default.checkExists).toBe('function');
      expect(typeof emailConnectTriggerNode.webhookMethods.default.create).toBe('function');
      expect(typeof emailConnectTriggerNode.webhookMethods.default.delete).toBe('function');
    });

    test('EmailConnect node should have loadOptions methods', () => {
      expect(emailConnectNode.methods).toBeDefined();
      expect(emailConnectNode.methods.loadOptions).toBeDefined();
      expect(typeof emailConnectNode.methods.loadOptions.getDomains).toBe('function');
      expect(typeof emailConnectNode.methods.loadOptions.getAliases).toBe('function');
      expect(typeof emailConnectNode.methods.loadOptions.getWebhooks).toBe('function');
    });

    test('EmailConnect trigger should have loadOptions methods', () => {
      expect(emailConnectTriggerNode.methods).toBeDefined();
      expect(emailConnectTriggerNode.methods.loadOptions).toBeDefined();
      expect(typeof emailConnectTriggerNode.methods.loadOptions.getDomains).toBe('function');
    });
  });
});
