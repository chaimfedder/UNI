import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CreateOrderForm  from './CreateOrderForm';
import ImportOrderExcel from './ImportOrderExcel';

export default function NewOrdersTab() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(null); // null | 'create' | 'import'

  // ── Selection screen ─────────────────────────────────────────
  if (!tab) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-800">{t('orders.title')}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          {/* Create */}
          <button
            onClick={() => setTab('create')}
            className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 transition-all text-center"
            style={{ borderColor: '#C9A84C', backgroundColor: '#FFFBEB' }}
          >
            <span className="text-4xl">📋</span>
            <div>
              <div className="font-bold text-lg" style={{ color: '#1A1A1A' }}>
                {t('orders.createTab')}
              </div>
              <div className="text-sm text-gray-500 mt-1">מלא טופס הזמנה חדשה</div>
            </div>
          </button>

          {/* Import */}
          <button
            onClick={() => setTab('import')}
            className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 transition-all text-center"
            style={{ borderColor: '#C9A84C', backgroundColor: '#FFFBEB' }}
          >
            <span className="text-4xl">📊</span>
            <div>
              <div className="font-bold text-lg" style={{ color: '#1A1A1A' }}>
                {t('orders.importTab')}
              </div>
              <div className="text-sm text-gray-500 mt-1">טען הזמנה מקובץ Excel</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Selected view ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setTab(null)}
          className="btn-secondary btn-sm"
        >
          ← חזור
        </button>
        <h1 className="text-xl font-bold text-gray-800">
          {tab === 'create' ? t('orders.createTab') : t('orders.importTab')}
        </h1>
      </div>

      {tab === 'create' && <CreateOrderForm />}
      {tab === 'import' && <ImportOrderExcel />}
    </div>
  );
}
