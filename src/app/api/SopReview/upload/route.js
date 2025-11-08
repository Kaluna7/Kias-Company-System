export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

function extractSOPsFromText(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const keywords = ['sop','procedure','steps','purpose','scope','responsibilities','standard operating procedure'];
  const results = [];
  for (let i=0;i<lines.length;i++){
    const low = lines[i].toLowerCase();
    for (const kw of keywords){
      if (low.includes(kw)){
        const start = Math.max(0,i-2);
        const end = Math.min(lines.length-1,i+4);
        results.push({ title: lines[i].slice(0,200), content: lines.slice(start,end+1).join('\n') });
        break;
      }
    }
  }
  const seen=new Set(), uniq=[];
  for(const r of results){ const k=r.content.slice(0,200); if(!seen.has(k)){ seen.add(k); uniq.push(r); } }
  return uniq;
}

async function saveSopsToDb(sops, filename) {
  if (!Array.isArray(sops) || sops.length === 0) return [];
  const inserted = [];
  for (const sop of sops) {
    const q = `INSERT INTO sops (title, content, source_filename, created_at)
               VALUES ($1,$2,$3,NOW())
               RETURNING id, title, content, source_filename, created_at`;
    const vals = [sop.title, sop.content, filename];
    const res = await query(q, vals);
    inserted.push(res.rows[0]);
  }
  return inserted;
}

async function safeParsePdfWithPdfParse(buffer) {
  const pdfModule = await import('pdf-parse');
  const pdfParse = pdfModule.default || pdfModule;

  let nodeBuffer;
  if (Buffer.isBuffer(buffer)) nodeBuffer = buffer;
  else if (buffer instanceof ArrayBuffer) nodeBuffer = Buffer.from(buffer);
  else if (ArrayBuffer.isView(buffer)) nodeBuffer = Buffer.from(buffer.buffer);
  else throw new Error('Invalid buffer format for PDF parsing');

  const parsed = await pdfParse(nodeBuffer);
  return parsed?.text || '';
}

export async function POST(request) {
  try {
    const form = await request.formData().catch(()=>null);
    const file = form?.get('file');

    if (!file) {
      const body = await request.json().catch(()=>null);
      if (!body?.data || !body?.filename) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      const buffer = Buffer.from(body.data, 'base64');
      const text = await safeParsePdfWithPdfParse(buffer);
      const sops = extractSOPsFromText(text);
      const inserted = await saveSopsToDb(sops, body.filename);
      return NextResponse.json({ insertedCount: inserted.length, inserted }, { status: 200 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = await safeParsePdfWithPdfParse(buffer);

    const sops = extractSOPsFromText(text);
    const inserted = await saveSopsToDb(sops, file.name || 'uploaded.pdf');

    return NextResponse.json({ insertedCount: inserted.length, inserted }, { status: 200 });
  } catch (err) {
    console.error('upload route error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
