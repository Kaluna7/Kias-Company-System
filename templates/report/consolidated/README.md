# Template DOCX — Opsi 1 (Docxtemplater)

Buat file **`template.docx`** di folder ini (belum di-commit — tim template yang menyiapkan).

## Contoh placeholder di Word / ONLYOFFICE

```
{company_name}
INTERNAL AUDIT REPORT — {year}

Period: {period_start} – {period_end}
Date of issue: {assessment_date}

{#findings}
Department: {department}
Finding: {title}
Severity: {severity}
Recommendation: {recommendation}
{/findings}
```

## Aktifkan di proyek

```env
REPORT_DOCX_ENGINE=docxtemplater
```

Tanpa `template.docx`, API akan error — gunakan `REPORT_DOCX_ENGINE=docxjs` (default) untuk laporan konsolidasi penuh yang di-generate dari kode.

## Mapping data

Field yang diisi dari payload ada di `src/app/lib/report/docx/docxtemplaterEngine.js` (`mapPayloadToTemplateData`).

Tambahkan placeholder baru di Word **dan** field di fungsi mapping tersebut.

## Keuntungan template

- Header/footer dan nomor halaman diatur di Word.
- Tabel panjang pecah halaman otomatis.
- Tim non-programmer bisa mengubah layout tanpa deploy kode.
