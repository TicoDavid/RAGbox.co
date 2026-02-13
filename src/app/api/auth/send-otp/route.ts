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

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP(normalizedEmail);

    // In production, send email via SendGrid/Resend/etc
    // In development, return OTP in response for testing
    return NextResponse.json({
      success: true,
      message: "OTP sent to email",
      ...(process.env.NODE_ENV === "development" && { otp }),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
