import { NextResponse } from "next/server";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  getTwilioClient,
  getVerifyServiceSid,
  TwilioConfigurationError,
} from "@/lib/twilio";

export async function POST(request) {
  try {
    const body = await request.json();
    const rawPhone = String(body.phone || "").trim();

    if (!rawPhone) {
      return NextResponse.json(
        { error: "Enter your phone number." },
        { status: 400 }
      );
    }

    const parsedPhone = parsePhoneNumberFromString(rawPhone, "US");

    if (!parsedPhone || !parsedPhone.isValid()) {
      return NextResponse.json(
        { error: "Enter a valid US phone number." },
        { status: 400 }
      );
    }

    const phoneNumber = parsedPhone.number;
    const twilioClient = getTwilioClient();
    const verifyServiceSid = getVerifyServiceSid();

    await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: phoneNumber,
        channel: "sms",
      });

    return NextResponse.json({
      success: true,
      phone: phoneNumber,
      message: "Verification code sent.",
    });
  } catch (error) {
    console.error("Twilio send-code error:", error);

    if (error instanceof TwilioConfigurationError) {
      return NextResponse.json(
        { error: "SMS verification is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "The verification code could not be sent.",
      },
      { status: 500 }
    );
  }
}
