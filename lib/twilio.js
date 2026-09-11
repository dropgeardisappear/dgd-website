import "server-only";
import twilio from "twilio";

export class TwilioConfigurationError extends Error {
  constructor(name) {
    super(`Missing environment variable: ${name}`);
    this.name = "TwilioConfigurationError";
  }
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new TwilioConfigurationError(name);
  }

  return value;
}

// Read SMS credentials only when sending or verifying a message. Next.js also
// imports route modules during builds, where optional SMS settings may be absent.
export function getTwilioClient() {
  return twilio(
    requiredEnv("TWILIO_ACCOUNT_SID"),
    requiredEnv("TWILIO_AUTH_TOKEN")
  );
}

export function getVerifyServiceSid() {
  return requiredEnv("TWILIO_VERIFY_SERVICE_SID");
}

export function getMessagingServiceSid() {
  return requiredEnv("TWILIO_MESSAGING_SERVICE_SID");
}
