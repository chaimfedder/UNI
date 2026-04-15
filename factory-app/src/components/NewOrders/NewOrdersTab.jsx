import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CreateOrderForm  from './CreateOrderForm';
import ImportOrderExcel from './ImportOrderExcel';

export default function NewOrdersTab() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('create'); // 'create' | 'import'

  return (
    <div className="space-y-4">
      {/* Tab header */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-800">{t('orders.title')}</h1>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => setTab('create')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors
              ${tab === 'create' ? 'font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            style={tab === 'create' ? { backgroundColor: '#C9A84C', color: '#111111' } : {}}
          >
            {t('orders.createTab')}
          </button>
          <button
            onClick={() => setTab('import')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors
              ${tab === 'import' ? 'font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            style={tab === 'import' ? { backgroundColor: '#C9A84C', color: '#111111' } : {}}
          >
            {t('orders.importTab')}
          </button>
        </div>
      </div>

      {tab === 'create' && <CreateOrderForm />}
      {tab === 'import' && <ImportOrderExcel />}
    </div>
  );
}
