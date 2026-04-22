import { useState } from 'react';
import InvoiceTable from './InvoiceTable';
import UploadInvoicePDF from './UploadInvoicePDF';
import ManualInvoiceForm from './ManualInvoiceForm';

export default function InvoicesTab() {
  const [view, setView] = useState('table'); // 'table' | 'upload' | 'manual'

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>חשבוניות</h1>
          <p className="text-sm text-gray-500">ניהול חשבוניות ספקים</p>
        </div>

        {view === 'table' ? (
          <div className="flex gap-2">
            <button onClick={() => setView('upload')} className="btn-primary">
              📤 העלה PDF
            </button>
            <button onClick={() => setView('manual')} className="btn-secondary">
              ✏️ הזנה ידנית
            </button>
          </div>
        ) : (
          <button onClick={() => setView('table')} className="btn-secondary">
            ← חזור לרשימה
          </button>
        )}
      </div>

      {/* Content */}
      {view === 'table' && <InvoiceTable />}
      {view === 'upload' && (
        <UploadInvoicePDF
          onDone={() => setView('table')}
          onCancel={() => setView('table')}
        />
      )}
      {view === 'manual' && (
        <ManualInvoiceForm
          onDone={() => setView('table')}
          onCancel={() => setView('table')}
        />
      )}
    </div>
  );
}
