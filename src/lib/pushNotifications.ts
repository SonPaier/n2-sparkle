import { supabase } from '@/integrations/supabase/client';

interface PushNotificationParams {
  instanceId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  userId?: string;
}

/**
 * Sends a push notification to all subscribers of the given instance (or specific user).
 * Silently catches errors - push notifications are non-blocking.
 */
export async function sendPushNotification({
  instanceId,
  title,
  body,
  url = '/',
  tag,
  userId,
}: PushNotificationParams): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        instanceId,
        title,
        body,
        url,
        tag,
        userId,
      },
    });
  } catch (error) {
    console.error('[Push] Failed to send notification:', error);
  }
}
