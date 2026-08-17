import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function POST(request) {
  try {
    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const accessToken = authorization
      .slice("Bearer ".length)
      .trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Your login token is missing." },
        { status: 401 }
      );
    }

    const supabase = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            userError?.message ||
            "Your login session could not be verified.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const postId = String(body?.postId || "").trim();

    if (!postId) {
      return NextResponse.json(
        { error: "A build ID is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      "approve_build_as_admin",
      {
        build_id: postId,
      }
    );

    if (error) {
      console.error("Approval RPC failed:", error);

      return NextResponse.json(
        {
          error:
            error.message ||
            "The build could not be approved.",
        },
        {
          status: error.message
            ?.toLowerCase()
            .includes("admin access")
            ? 403
            : 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      postId: data,
      smsSent: false,
      smsReason:
        "Build approved. SMS notification was skipped.",
      message: "Build approved successfully.",
    });
  } catch (error) {
    console.error("Approve-build route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The build could not be approved.",
      },
      { status: 500 }
    );
  }
}