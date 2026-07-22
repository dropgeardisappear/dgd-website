import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  twilioClient,
  verifyServiceSid,
} from "@/lib/twilio";

export async function POST(request) {
  try {
    const body = await request.json();

    const rawPhone = String(body.phone || "").trim();
    const code = String(body.code || "")
      .replace(/\D/g, "")
      .trim();

    const parsedPhone = parsePhoneNumberFromString(rawPhone, "US");

    if (!parsedPhone || !parsedPhone.isValid()) {
      return NextResponse.json(
        { error: "Enter a valid phone number." },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Enter the verification code." },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in to verify a phone number." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Supabase user error:", userError);

      return NextResponse.json(
        { error: "Your login session is invalid or expired." },
        { status: 401 }
      );
    }

    const phoneNumber = parsedPhone.number;

    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code,
      });

    if (verificationCheck.status !== "approved") {
      return NextResponse.json(
        {
          error: "That verification code is incorrect or expired.",
        },
        { status: 400 }
      );
    }

    const { error: preferenceError } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          phone: phoneNumber,
          phone_verified: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (preferenceError) {
      console.error(
        "Notification preferences save error:",
        preferenceError
      );

      return NextResponse.json(
        {
          error:
            "The phone was verified, but it could not be saved to your account.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      phone: phoneNumber,
      verified: true,
      message: "Phone number verified and saved successfully.",
    });
  } catch (error) {
    console.error("Twilio verify-code error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "The verification code could not be checked.",
      },
      { status: 500 }
    );
  }
}