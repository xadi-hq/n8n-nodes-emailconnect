# Debugging Webhook Cleanup Issue

## The Problem
When deleting an n8n trigger node, the webhook is not being properly restored to its previous state. Instead:
- The n8n webhook remains attached to the alias/domain
- The previous webhook becomes orphaned

## Expected Behavior
1. Create n8n node for Alias A (which has Webhook A) → creates Webhook B and attaches to Alias A
2. Delete n8n node → should restore Webhook A to Alias A and delete Webhook B

## Actual Behavior
1. Create n8n node for Alias A (which has Webhook A) → creates Webhook B and attaches to Alias A  
2. Delete n8n node → Webhook B remains attached to Alias A, Webhook A becomes orphaned

## Debugging Steps

### 1. Check if delete method is called
Look for this log message when deleting the node:
```
EmailConnect Trigger Delete - Method called!
```

### 2. Check stored configuration
Look for this log message during node creation:
```
EmailConnect Trigger Create - Storing configuration for cleanup: { ... }
```

### 3. Check cleanup process
Look for these log messages during deletion:
```
EmailConnect Trigger Delete - Starting cleanup: { ... }
Detaching webhook from alias: [aliasId]
Deleting webhook: [webhookId]
Restoring previous alias webhook: [previousWebhookId]
EmailConnect Trigger Delete - Cleanup completed
```

## Possible Issues

### Issue 1: Delete method not called
If you don't see "EmailConnect Trigger Delete - Method called!" then n8n isn't calling the delete method.

**Possible causes:**
- Node deletion doesn't trigger webhook cleanup in all scenarios
- Error in n8n preventing the call

### Issue 2: Static data not preserved
If the delete method is called but stored data is empty/undefined.

**Possible causes:**
- Static data not being saved properly during creation
- Static data being cleared before deletion
- Different node instance during deletion

### Issue 3: API calls failing
If delete method runs but restoration fails.

**Possible causes:**
- API errors during webhook detachment
- API errors during webhook deletion  
- API errors during webhook restoration

## Testing Instructions

1. **Enable console logging** in your n8n instance to see the debug messages
2. **Create a trigger node** for an alias that already has a webhook
3. **Check creation logs** to verify configuration is stored
4. **Delete the trigger node**
5. **Check deletion logs** to see what happens

## Potential Solutions

### Solution 1: Force delete method call
If delete method isn't being called, we might need to investigate n8n's webhook lifecycle.

### Solution 2: Improve static data handling
If static data isn't preserved, we might need alternative storage.

### Solution 3: Better error handling
If API calls are failing, we need more robust error handling and fallback strategies.

## Next Steps

1. Test with the added logging to identify which issue is occurring
2. Based on the logs, implement the appropriate fix
3. Consider adding a manual cleanup endpoint as a fallback
