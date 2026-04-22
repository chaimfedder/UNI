import { useState, useRef } from 'react';
import { addInvoice, uploadInvoicePDF } from '../../firebase/invoices';

const EMPTY_ITEM = {
  orderNumber: '',
  confNumber: '',
  materialType: '',
  weight: '',
  color: '',
  description: '',
  quantity: '',
  unitPrice: '',
  lineTotal: '',
};

const EMPTY_INVOICE = {
  invoiceNumber: '',
  invoiceDate: '',
  supplier: '',
  customer: '',
  currency: '',
  shippingCost: '',
  subtotal: '',
  total: '',
  items: [],
};

const HEADER_FIELDS = [
  { key: 'invoiceNumber', label: 'מספר חשבונית' },
  { key: 'invoiceDate',   label: 'תאריך' },
  { key: 'supplier',      label: 'ספק' },
  { key: 'customer',      label: 'לקוח' },
  { key: 'currency',      label: 'מטבע' },
  { key: 'shippingCost',  label: 'עלות משלוח' },
  { key: 'subtotal',      label: 'סכום לפני מע"מ' },
  { key: 'total',         label: 'סה"כ' },
];

const ITEM_COLUMNS = [
  { key: 'orderNumber',  label: 'מס׳ הזמנה' },
  { key: 'confNumber',   label: 'מס׳ אישור' },
  { key: 'materialType', label: 'סוג חומר גלם' },
  { key: 'weight',       label: 'משקל' },
  { key: 'color',        label: 'צבע' },
  { key: 'description',  label: 'תיאור' },
  { key: 'quantity',     label: 'כמות' },
  { key: 'unitPrice',    label: 'מחיר יחידה' },
  { key: 'lineTotal',    label: 'סה"כ שורה' },
];

const EXTRACT_PROMPT = `Extract all invoice data from this PDF and return STRICT JSON ONLY with absolutely no explanations, markdown, or extra text outside the JSON.

Return this exact JSON structure:
{
  "invoiceNumber": "",
  "invoiceDate": "",
  "supplier": "",
  "customer": "",
  "currency": "",
  "shippingCost": "",
  "subtotal": "",
  "total": "",
  "items": [
    {
      "orderNumber": "",
      "confNumber": "",
      "materialType": "",
      "weight": "",
      "color": "",
      "description": "",
      "quantity": "",
      "unitPrice": "",
      "lineTotal": ""
    }
  ]
}

Each item may contain a field in the format "10B/210 0.011" — if so, split it into:
- "materialType": the part before the "/" (e.g. "10B")
- "weight": the part after "/" and before the space (e.g. "210")
- "color": the part after the space (e.g. "0.011")

Rules:
- Return ONLY valid JSON, nothing else — no code fences, no extra words
- Leave empty string "" for any field not found in the document
- Do NOT invent or guess missing values
- Extract every line item you find into the items array`;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadInvoicePDF({ onDone, onCancel }) {
  const [stage, setStage]     = useState('idle'); // idle | extracting | preview | saving
  const [file, setFile]       = useState(null);
  const [invoice, setInvoice] = useState(EMPTY_INVOICE);
  const [error, setError]     = useState('');
  const fileRef = useRef();

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('יש לבחור קובץ PDF בלבד');
      return;
    }
    setFile(f);
    setError('');
  }

  async function handleExtract() {
    if (!file) return;
    setStage('extracting');
    setError('');
    try {
      const base64 = await fileToBase64(file);
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'pdfs-2024-09-25',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              },
              { type: 'text', text: EXTRACT_PROMPT },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `שגיאת API: ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text || '';

      // Strip optional markdown code fences
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Claude לא החזיר JSON תקין');

      const extracted = JSON.parse(jsonMatch[0]);
      setInvoice({
        ...EMPTY_INVOICE,
        ...extracted,
        items: (extracted.items || []).map(item => ({ ...EMPTY_ITEM, ...item })),
      });
      setStage('preview');
    } catch (err) {
      setError(`שגיאה בחילוץ נתונים: ${err.message}`);
      setStage('idle');
    }
  }

  async function handleSave() {
    setStage('saving');
    setError('');
    try {
      let pdfFileUrl = '';
      let storagePath = '';

      if (file) {
        const uploaded = await uploadInvoicePDF(file, invoice.invoiceNumber);
        pdfFileUrl   = uploaded.url;
        storagePath  = uploaded.storagePath;
      }

      await addInvoice({ ...invoice, pdfFileUrl, storagePath });
      onDone();
    } catch (err) {
      setError(`שגיאה בשמירה: ${err.message}`);
      setStage('preview');
    }
  }

  function updateField(field, value) {
    setInvoice(prev => ({ ...prev, [field]: value }));
  }

  function updateItem(index, field, value) {
    setInvoice(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function addItem() {
    setInvoice(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index) {
    setInvoice(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  // ── Upload stage ──────────────────────────────────────────────────────────────

  if (stage === 'idle' || stage === 'extracting') {
    return (
      <div className="card max-w-xl mx-auto">
        <div className="card-header">📄 העלאת חשבונית PDF</div>
        <div className="card-body space-y-4">

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-yellow-50 transition-colors"
            style={{ borderColor: '#C9A84C' }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div>
                <p className="text-2xl mb-1">✅</p>
                <p className="font-semibold text-green-700">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-2">📄</p>
                <p className="text-gray-600 font-medium">לחץ לבחירת קובץ PDF</p>
                <p className="text-xs text-gray-400 mt-1">PDF בלבד</p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="btn-secondary">ביטול</button>
            <button
              onClick={handleExtract}
              disabled={!file || stage === 'extracting'}
              className="btn-primary"
            >
              {stage === 'extracting' ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  מחלץ נתונים…
                </span>
              ) : '🤖 חלץ נתונים עם AI'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview / edit stage ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <span>✏️ תצוגה מקדימה — בדוק ועדכן לפני שמירה</span>
          <span className="text-xs text-gray-400 font-normal">{file?.name}</span>
        </div>
        <div className="card-body space-y-5">

          {/* Header fields grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {HEADER_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="form-label">{label}</label>
                <input
                  className="form-input"
                  value={invoice[key] || ''}
                  onChange={e => updateField(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">
                פריטים
                <span className="ms-1 text-gray-400 font-normal">({invoice.items.length})</span>
              </h3>
              <button onClick={addItem} className="btn-sm btn-secondary">+ הוסף שורה</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="factory-table">
                <thead>
                  <tr>
                    {ITEM_COLUMNS.map(c => <th key={c.key}>{c.label}</th>)}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.length === 0 && (
                    <tr>
                      <td colSpan={ITEM_COLUMNS.length + 1} className="text-gray-400 py-4">
                        אין פריטים — לחץ "+ הוסף שורה"
                      </td>
                    </tr>
                  )}
                  {invoice.items.map((item, idx) => (
                    <tr key={idx}>
                      {ITEM_COLUMNS.map(({ key }) => (
                        <td key={key}>
                          <input
                            className="w-full bg-transparent text-center text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 rounded px-1"
                            value={item[key] || ''}
                            onChange={e => updateItem(idx, key, e.target.value)}
                          />
                        </td>
                      ))}
                      <td>
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-red-400 hover:text-red-600 text-xs"
                          title="מחק שורה"
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={onCancel} className="btn-secondary">ביטול</button>
            <button
              onClick={handleSave}
              disabled={stage === 'saving'}
              className="btn-primary"
            >
              {stage === 'saving' ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  שומר…
                </span>
              ) : '💾 שמור חשבונית'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
