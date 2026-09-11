import { Resend } from "resend";

export async function POST(req) {
  try {
    // This route is also imported during builds, before optional email
    // credentials are available. Initialize the client only for a request.
    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (!apiKey) {
      return Response.json(
        {
          success: false,
          error: "Email notifications are temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    const { email, subject, message } = await req.json();
    const resend = new Resend(apiKey);

    const data = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject,
      html: `<p>${message}</p>`,
    });

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
