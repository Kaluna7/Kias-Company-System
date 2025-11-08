"use client"

import { useState, useEffect } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchSops();
  }, []);

  async function fetchSops() {
    const res = await fetch('/api/sops');
    const data = await res.json();
    setRows(data.rows || []);
  }

 async function handleSubmit(e) {
  e.preventDefault();
  if (!file) return setMessage('Pilih file PDF terlebih dahulu');
  setLoading(true);
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Inserted ${data.insertedCount} SOP item(s)`);
      fetchSops();
    } else {
      setMessage(data.error || 'Upload error');
    }
  } catch (err) {
    console.error(err);
    setMessage('Upload failed');
  } finally { setLoading(false); }
}



  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'Arial, sans-serif'}}>
      <h1>Upload PDF (SOP Extractor)</h1>
      <form onSubmit={handleSubmit}>
        <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
        <button type="submit" disabled={loading} style={{marginLeft:12}}>{loading ? 'Processing...' : 'Upload & Extract'}</button>
      </form>
      <p>{message}</p>

      <h2>Extracted SOPs</h2>
      <table border="1" cellPadding="8" style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Content (preview)</th>
            <th>Source File</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.title}</td>
              <td><pre style={{whiteSpace:'pre-wrap', maxHeight:120, overflow:'auto'}}>{r.content}</pre></td>
              <td>{r.source_filename}</td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}