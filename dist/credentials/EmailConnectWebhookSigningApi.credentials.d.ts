import { ICredentialType, INodeProperties } from 'n8n-workflow';
/**
 * The signing secret of ONE EmailConnect webhook. Selected per EmailConnect
 * Trigger (Verify Signatures on), so each trigger, and so each webhook, can
 * have its own secret. The trigger registers it on its webhook at activation.
 *
 * Holds no API access: it is never sent anywhere except in the alias upsert
 * that stores it on the webhook.
 */
export declare class EmailConnectWebhookSigningApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    properties: INodeProperties[];
}
