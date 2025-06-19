// app/api/dollar-rate/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  const API_KEY = process.env.EXCHANGE_RATE_API_KEY; // Make sure this is defined in .env.local
  const url = 'https://api.apilayer.com/exchangerates_data/latest?base=USD&symbols=PKR';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: API_KEY!,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch exchange rate' }, { status: response.status });
    }

    const data = await response.json();
    const rate = data.rates?.PKR;

    return NextResponse.json({ rate });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
