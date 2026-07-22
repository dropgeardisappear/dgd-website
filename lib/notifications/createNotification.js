import "server-only";

import {
  messagingServiceSid,
  twilioClient,
} from "@/lib/twilio";

export async function createNotification({
  supabaseAdmin,
  userId,
  postId = null,
  type,
  message,
  preferenceKey = null,
  smsBody = null,
}) {
  if (!supabaseAdmin) {
    throw new Error("A Supabase admin client is required.");
  }

  if (!userId) {
    throw new Error("A notification recipient is required.");
  }

  if (!type || !message) {
    throw new Error("Notification type and message are required.");
  }

  const { data: notification, error: notificationError } =
    await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        post_id: postId,
        type,
        message,
        is_read: false,
      })
      .select()
      .single();

  if (notificationError) {
    throw new Error(
      `Could not create notification: ${notificationError.message}`
    );
  }

  if (!preferenceKey || !smsBody) {
    return {
      notification,
      smsSent: false,
      smsReason: "SMS was not requested.",
    };
  }

  const { data: preferences, error: preferenceError } =
    await supabaseAdmin
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

  if (preferenceError) {
    return {
      notification,
      smsSent: false,
      smsReason: "Notification preferences could not be loaded.",
    };
  }

  if (!preferences) {
    return {
      notification,
      smsSent: false,
      smsReason: "The user has no notification preferences.",
    };
  }

  if (!preferences[preferenceKey]) {
    return {
      notification,
      smsSent: false,
      smsReason: "This SMS notification is disabled.",
    };
  }

  if (!preferences.phone_verified || !preferences.phone) {
    return {
      notification,
      smsSent: false,
      smsReason: "The user does not have a verified phone number.",
    };
  }

  try {
    const sms = await twilioClient.messages.create({
      messagingServiceSid,
      to: preferences.phone,
      body: smsBody,
    });

    return {
      notification,
      smsSent: true,
      smsSid: sms.sid,
      smsReason: null,
    };
  } catch (error) {
    console.error("Notification SMS error:", error);

    return {
      notification,
      smsSent: false,
      smsReason:
        error instanceof Error
          ? error.message
          : "Twilio could not send the SMS.",
    };
  }
}