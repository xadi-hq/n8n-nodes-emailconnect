/**
 * replyFields: the trigger adds what a reply needs to land in the same thread,
 * next to the payload. Sender-agnostic: plain values plus a header map.
 */

const {
  EmailConnectTrigger,
  buildReplyFields,
} = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn(),
  getDomainOptions: jest.fn().mockResolvedValue([]),
}));

const basePayload = (overrides = {}) => ({
  id: 'msg_123',
  message: {
    sender: { email: 'alice@example.com', name: 'Alice Martin' },
    recipient: { email: 'support@in.example.com', name: null, tag: null },
    subject: 'Cannot reset my password',
    ...overrides.message,
  },
  envelope: {
    messageId: '<abc123@example.com>',
    inReplyTo: null,
    references: [],
    ...overrides.envelope,
  },
  domainId: 'dom_1',
  aliasId: 'ali_1',
});

describe('buildReplyFields', () => {
  test('a first email: reply to the sender, In-Reply-To and References are its Message-ID', () => {
    expect(buildReplyFields(basePayload())).toEqual({
      to: { email: 'alice@example.com', name: 'Alice Martin' },
      subject: 'Re: Cannot reset my password',
      inReplyTo: '<abc123@example.com>',
      references: ['<abc123@example.com>'],
      headers: {
        'In-Reply-To': '<abc123@example.com>',
        References: '<abc123@example.com>',
      },
    });
  });

  test('a reply in a longer thread: References keeps the chain and appends this email', () => {
    const fields = buildReplyFields(basePayload({
      message: { subject: 'Re: Cannot reset my password' },
      envelope: {
        messageId: '<c3@example.com>',
        inReplyTo: '<c2@example.com>',
        references: ['<c1@example.com>', '<c2@example.com>'],
      },
    }));

    expect(fields.references).toEqual(['<c1@example.com>', '<c2@example.com>', '<c3@example.com>']);
    expect(fields.headers.References).toBe('<c1@example.com> <c2@example.com> <c3@example.com>');
    expect(fields.inReplyTo).toBe('<c3@example.com>');
  });

  test('does not add a second "Re:", whatever its case', () => {
    expect(buildReplyFields(basePayload({ message: { subject: 'RE: Invoice' } })).subject).toBe('RE: Invoice');
    expect(buildReplyFields(basePayload({ message: { subject: 're:Invoice' } })).subject).toBe('re:Invoice');
  });

  test('no subject gives null, so the workflow decides', () => {
    expect(buildReplyFields(basePayload({ message: { subject: null } })).subject).toBeNull();
    expect(buildReplyFields(basePayload({ message: { subject: '   ' } })).subject).toBeNull();
  });

  test('does not repeat the Message-ID when the sender already listed it in References', () => {
    const fields = buildReplyFields(basePayload({
      envelope: { messageId: '<c2@example.com>', references: ['<c1@example.com>', '<c2@example.com>'] },
    }));
    expect(fields.references).toEqual(['<c1@example.com>', '<c2@example.com>']);
  });

  test('without a Message-ID there are no threading headers, but the chain is kept', () => {
    const fields = buildReplyFields(basePayload({
      envelope: { messageId: '', references: ['<c1@example.com>'] },
    }));
    expect(fields.inReplyTo).toBeNull();
    expect(fields.references).toEqual(['<c1@example.com>']);
    expect(fields.headers).toEqual({});
  });

  test('prefers the Reply-To header over the From address', () => {
    const fields = buildReplyFields(basePayload({
      envelope: { headers: { 'reply-to': 'tickets@example.com' } },
    }));
    expect(fields.to).toEqual({ email: 'tickets@example.com', name: null });
  });

  test('reads the address out of a "Name <address>" Reply-To', () => {
    const fields = buildReplyFields(basePayload({
      envelope: { headers: { 'reply-to': 'Ticket Desk <tickets@example.com>' } },
    }));
    expect(fields.to.email).toBe('tickets@example.com');
  });

  test('survives a payload without envelope or sender', () => {
    expect(buildReplyFields({ message: { subject: 'Hi there all' } })).toEqual({
      to: { email: null, name: null },
      subject: 'Re: Hi there all',
      inReplyTo: null,
      references: [],
      headers: {},
    });
  });
});

describe('webhook() output', () => {
  const run = async (bodyData, addReplyFields) => {
    const context = {
      getNodeParameter: jest.fn((param, fallback) => {
        if (param === 'verifySignatures') return false;
        if (param === 'addReplyFields') return addReplyFields === undefined ? fallback : addReplyFields;
        return '';
      }),
      getCredentials: jest.fn(),
      getRequestObject: jest.fn().mockReturnValue({ headers: {}, rawBody: undefined }),
      getResponseObject: jest.fn(),
      getBodyData: jest.fn().mockReturnValue(bodyData),
      logger: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
    };
    const result = await new EmailConnectTrigger().webhook.call(context);
    return result.workflowData[0][0].json;
  };

  test('adds replyFields next to the payload, leaving the payload untouched', async () => {
    const payload = basePayload();
    const json = await run(payload);

    expect(json.replyFields.inReplyTo).toBe('<abc123@example.com>');
    expect(json.message).toEqual(payload.message);
    expect(json.envelope).toEqual(payload.envelope);
    expect(payload).not.toHaveProperty('replyFields');
  });

  test('can be switched off', async () => {
    const json = await run(basePayload(), false);
    expect(json).not.toHaveProperty('replyFields');
  });

  test('is skipped when a custom payload template removed message', async () => {
    const json = await run({ customer: 'acme', text: 'hello' });
    expect(json).toEqual({ customer: 'acme', text: 'hello' });
  });

  test('the option defaults to on', () => {
    const property = new EmailConnectTrigger().description.properties.find((p) => p.name === 'addReplyFields');
    expect(property.default).toBe(true);
    expect(property.type).toBe('boolean');
  });
});
