import { NextRequest, NextResponse } from 'next/server'

/**
 * STORY-236: Feedback API stub
 *
 * Returns 501 until Sheldon builds the backend table.
 * The frontend feedbackStore falls back to local persist.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // TODO: Sheldon — insert into feedback table
    return NextResponse.json(
      { success: true, id: body.id, message: 'Feedback received (local only — backend pending)' },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Invalid feedback payload' },
      { status: 400 }
    )
  }
}

export async function GET() {
  // TODO: Sheldon — query feedback table
  return NextResponse.json(
    { tickets: [], message: 'Backend not yet implemented — using local store' },
    { status: 200 }
  )
}
