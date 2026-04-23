import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import InvoiceTable from './InvoiceTable';
import UploadInvoicePDF from './UploadInvoicePDF';
import ManualInvoiceForm from './ManualInvoiceForm';

export default function InvoicesTab() {
  const { t } = useTranslation();
  const [view,     setView]     = useState('table'); // 'table' | 'upload' | 'manual'
  const [viewMode, setViewMode] = useState('invoice'); // 'invoice' | 'material'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>{t('nav.invoices')}</h1>
          <p className="text-sm text-gray-500">{t('invoices.subtitle')}</p>
        </div>

        {view === 'table' ? (
          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
              <button
                onClick={() => setViewMode('invoice')}
                className="px-3 py-1.5 transition-colors"
                style={viewMode === 'invoice'
                  ? { backgroundColor: '#C9A84C', color: '#111' }
                  : { backgroundColor: 'white', color: '#555' }}
              >
                {t('invoices.viewInvoices')}
              </button>
              <button
                onClick={() => setViewMode('material')}
                className="px-3 py-1.5 transition-colors border-r border-gray-200"
                style={viewMode === 'material'
                  ? { backgroundColor: '#C9A84C', color: '#111' }
                  : { backgroundColor: 'white', color: '#555' }}
              >
                {t('invoices.viewMaterials')}
              </button>
            </div>

            <button onClick={() => setView('upload')} className="btn-primary">
              📤 {t('invoices.uploadPdf')}
            </button>
            <button onClick={() => setView('manual')} className="btn-secondary">
              ✏️ {t('invoices.manualEntry')}
            </button>
          </div>
        ) : (
          <button onClick={() => setView('table')} className="btn-secondary">
            ← {t('invoices.backToList')}
          </button>
        )}
      </div>

      {view === 'table'  && <InvoiceTable viewMode={viewMode} />}
      {view === 'upload' && <UploadInvoicePDF onDone={() => setView('table')} onCancel={() => setView('table')} />}
      {view === 'manual' && <ManualInvoiceForm onDone={() => setView('table')} onCancel={() => setView('table')} />}
    </div>
  );
}
