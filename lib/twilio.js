import "server-only";
import twilio from "twilio";

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const twilioClient = twilio(
  requiredEnv("TWILIO_ACCOUNT_SID"),
  requiredEnv("TWILIO_AUTH_TOKEN")
);

export const verifyServiceSid = requiredEnv(
  "TWILIO_VERIFY_SERVICE_SID"
);

export const messagingServiceSid = requiredEnv(
  "TWILIO_MESSAGING_SERVICE_SID"
);