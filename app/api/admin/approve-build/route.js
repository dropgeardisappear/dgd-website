import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";

export const runtime = "nodejs";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function createAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export async function POST(request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
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

    const supabaseAdmin = createAdminClient();

    // Verify the browser token against the same Supabase project.
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Admin token verification failed:", userError);

      return NextResponse.json(
        {
          error:
            "Your login session is invalid or expired. Sign out and back in.",
        },
        { status: 401 }
      );
    }

    // Check the profile belonging to the authenticated user ID.
    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, username, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Admin profile lookup failed:", {
        userId: user.id,
        email: user.email,
        profileError,
      });

      return NextResponse.json(
        {
          error: `Could not verify admin profile: ${profileError.message}`,
        },
        { status: 500 }
      );
    }

    if (!profile) {
      console.error("Admin profile row missing:", {
        userId: user.id,
        email: user.email,
      });

      return NextResponse.json(
        {
          error:
            "Your account does not have a matching profile row.",
        },
        { status: 403 }
      );
    }

    if (profile.is_admin !== true) {
      console.error("Admin permission denied:", {
        userId: user.id,
        email: user.email,
        username: profile.username,
        isAdmin: profile.is_admin,
      });

      return NextResponse.json(
        {
        error: `ADMIN API V2: Access denied for ${
  user.email || "unknown account"
}. Profile admin value: ${String(profile?.is_admin)}`,
        },
        { status: 403 }
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

    const {
      data: post,
      error: postError,
    } = await supabaseAdmin
      .from("posts")
      .select("id, title, user_id, status")
      .eq("id", postId)
      .maybeSingle();

    if (postError) {
      console.error("Build lookup failed:", postError);

      return NextResponse.json(
        {
          error: `Could not load the build: ${postError.message}`,
        },
        { status: 500 }
      );
    }

    if (!post) {
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

    const {
      data: approvedPost,
      error: approvalError,
    } = await supabaseAdmin
      .from("posts")
      .update({ status: "approved" })
      .eq("id", post.id)
      .eq("status", "pending")
      .select("id, title, user_id, status")
      .maybeSingle();

    if (approvalError) {
      console.error("Build approval failed:", approvalError);

      return NextResponse.json(
        {
          error: `Could not approve build: ${approvalError.message}`,
        },
        { status: 500 }
      );
    }

    if (!approvedPost) {
      return NextResponse.json(
        { error: "This build was already processed." },
        { status: 409 }
      );
    }

    let smsSent = false;
    let smsReason = "Notification was not attempted.";

    // Notification failure should not undo approval.
    if (approvedPost.user_id) {
      try {
        const notificationResult = await createNotification({
          supabaseAdmin,
          userId: approvedPost.user_id,
          postId: approvedPost.id,
          type: "build_approved",
          message: `${
            approvedPost.title || "Your build"
          } was approved and is now live.`,
          preferenceKey: "build_approved",
          smsBody:
            `DGD: Your build "${
              approvedPost.title || "Your build"
            }" was approved and is now live: ` +
            `https://www.dropgeardisappear.us/build/${approvedPost.id}`,
        });

        smsSent = Boolean(notificationResult?.smsSent);
        smsReason =
          notificationResult?.smsReason ||
          (smsSent
            ? "SMS accepted."
            : "SMS was not sent.");
      } catch (notificationError) {
        console.error(
          "Build approved, but notification failed:",
          notificationError
        );

        smsReason =
          notificationError instanceof Error
            ? notificationError.message
            : "Notification failed.";
      }
    } else {
      smsReason =
        "The build is not connected to a user account.";
    }

    return NextResponse.json({
      success: true,
      postId: approvedPost.id,
      smsSent,
      smsReason,
      message: smsSent
        ? "Build approved and SMS accepted by Twilio."
        : "Build approved successfully.",
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