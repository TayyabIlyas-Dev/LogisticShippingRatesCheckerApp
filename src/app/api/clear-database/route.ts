import { NextRequest, NextResponse } from 'next/server'
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const province = searchParams.get('province')

  if (!province) {
    return NextResponse.json({ error: 'Province is required' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://79e488e3-3feb-47f6-afc9-99f176e763b7-00-t6un1m7gnee5.pike.replit.dev/clear-database?province=${province}`, {
      method: 'DELETE',
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.detail || 'Failed to clear' }, { status: res.status })
    }

    return NextResponse.json({ message: data.message }) // 👈 message already includes line count
  } catch (error) {
    return NextResponse.json({ error: 'Server error while clearing database' }, { status: 500 })
  }
}
