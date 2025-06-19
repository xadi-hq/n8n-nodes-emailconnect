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

    test('should have event filtering options', () => {
      const description = emailConnectTriggerNode.description;
      const eventsProperty = description.properties.find(p => p.name === 'events');
      
      expect(eventsProperty).toBeDefined();
      expect(eventsProperty.type).toBe('multiOptions');
      expect(eventsProperty.options).toHaveLength(3);
      
      const eventValues = eventsProperty.options.map(o => o.value);
      expect(eventValues).toContain('email.received');
      expect(eventValues).toContain('email.processed');
      expect(eventValues).toContain('email.failed');
    });

    test('should have domain and alias configuration', () => {
      const description = emailConnectTriggerNode.description;

      const domainId = description.properties.find(p => p.name === 'domainId');
      const aliasMode = description.properties.find(p => p.name === 'aliasMode');
      const aliasId = description.properties.find(p => p.name === 'aliasId');
      const newAliasLocalPart = description.properties.find(p => p.name === 'newAliasLocalPart');


      expect(domainId).toBeDefined();
      expect(domainId.type).toBe('options');
      expect(domainId.required).toBe(true);
      expect(domainId.typeOptions.loadOptionsMethod).toBe('getDomains');

      expect(aliasMode).toBeDefined();
      expect(aliasMode.type).toBe('options');
      expect(aliasMode.options).toHaveLength(3);
      expect(aliasMode.default).toBe('existing');
      const aliasModeValues = aliasMode.options.map(o => o.value);
      expect(aliasModeValues).toContain('domain');
      expect(aliasModeValues).toContain('existing');
      expect(aliasModeValues).toContain('create');

      expect(aliasId).toBeDefined();
      expect(aliasId.type).toBe('options');
      expect(aliasId.typeOptions.loadOptionsMethod).toBe('getAliasesForDomain');
      expect(aliasId.displayOptions.show.aliasMode).toContain('existing');

      expect(newAliasLocalPart).toBeDefined();
      expect(newAliasLocalPart.type).toBe('string');
      expect(newAliasLocalPart.required).toBe(true);
      expect(newAliasLocalPart.displayOptions.show.aliasMode).toContain('create');
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
      expect(typeof emailConnectTriggerNode.methods.loadOptions.getAliasesForDomain).toBe('function');
    });
  });
});
