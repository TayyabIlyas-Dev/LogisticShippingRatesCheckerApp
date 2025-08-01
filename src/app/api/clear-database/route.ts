import { NextRequest, NextResponse } from 'next/server'
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const province = searchParams.get('province')

  if (!province) {
    return NextResponse.json({ error: 'Province is required' }, { status: 400 })
  }

  try {
    const res = await fetch(`http://localhost:8000/clear-database?province=${province}`, {
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
