import { NextRequest, NextResponse } from "next/server";
import { generateOTP } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    const otp = generateOTP(email);

    // In production, send email via SendGrid/Resend/etc
    // For development, log to console
    console.log(`\n🔐 OTP for ${email}: ${otp}\n`);

    // For demo: return OTP in response (REMOVE IN PRODUCTION)
    return NextResponse.json({
      success: true,
      message: "OTP sent to email",
      // Remove this in production - only for testing
      ...(process.env.NODE_ENV === "development" && { otp }),
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
