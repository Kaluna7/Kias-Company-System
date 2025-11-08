// app/api/sops/route.js
import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    const { rows } = await query('SELECT id, title, content, source_filename, created_at FROM sops ORDER BY created_at DESC');
    return NextResponse.json({ rows });
  } catch (e) {
    console.error('sops GET error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
