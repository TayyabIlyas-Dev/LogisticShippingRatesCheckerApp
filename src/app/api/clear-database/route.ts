import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest) {
  try {
    const res = await fetch('http://localhost:8000/clear-database', {
      method: 'DELETE',
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.detail || 'Failed to clear' }, { status: res.status });
    }

    return NextResponse.json({ message: data.message });
  } catch (error) {
    return NextResponse.json({ error: 'Server error while clearing database' }, { status: 500 });
  }
}
