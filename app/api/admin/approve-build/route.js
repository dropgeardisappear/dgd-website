import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";

export const runtime = "nodejs";

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const supabaseUrl = requiredEnv(
  "NEXT_PUBLIC_SUPABASE_URL"
);

const supabaseAnonKey = requiredEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
);

const supabaseServiceRoleKey = requiredEnv(
  "SUPABASE_SERVICE_ROLE_KEY"
);

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in as an admin." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
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
    } = await authClient.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your login session is invalid or expired." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json(
        { error: "Admin access only." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const postId = String(body.postId || "").trim();

    if (!postId) {
      return NextResponse.json(
        { error: "A build ID is required." },
        { status: 400 }
      );
    }

    const { data: post, error: postError } =
      await supabaseAdmin
        .from("posts")
        .select(
          "id, title, user_id, created_by, status"
        )
        .eq("id", postId)
        .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: "The build could not be found." },
        { status: 404 }
      );
    }

    if (post.status !== "pending") {
      return NextResponse.json(
        { error: "This build is no longer pending." },
        { status: 409 }
      );
    }

    const recipientUserId =
      post.user_id || post.created_by;

    if (!recipientUserId) {
      return NextResponse.json(
        {
          error:
            "This build is not connected to a user account.",
        },
        { status: 400 }
      );
    }

    const { data: approvedPost, error: approvalError } =
      await supabaseAdmin
        .from("posts")
        .update({
          status: "approved",
        })
        .eq("id", post.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

    if (approvalError) {
      throw new Error(
        `Could not approve build: ${approvalError.message}`
      );
    }

    if (!approvedPost) {
      return NextResponse.json(
        { error: "This build was already processed." },
        { status: 409 }
      );
    }

    let notificationResult;

    try {
      const buildTitle = post.title || "Your build";

      notificationResult = await createNotification({
        supabaseAdmin,
        userId: recipientUserId,
        postId: post.id,
        type: "build_approved",
        message: `${buildTitle} was approved and is now live.`,
        preferenceKey: "build_approved",
        smsBody:
          `DGD: Your build "${buildTitle}" was approved and is now live: ` +
          `https://dropgeardisappear.us/build/${post.id}`,
      });
    } catch (notificationError) {
      await supabaseAdmin
        .from("posts")
        .update({
          status: "pending",
        })
        .eq("id", post.id);

      throw notificationError;
    }

    return NextResponse.json({
      success: true,
      postId: post.id,
      smsSent: notificationResult.smsSent,
      smsReason: notificationResult.smsReason,
 message: notificationResult.smsSent
  ? "Build approved and SMS accepted by Twilio."
  : "Build approved and notification created.",
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