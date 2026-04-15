import { useTranslation } from 'react-i18next';

// PackingTab — placeholder until full implementation
export default function PackingTab() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-500">
        <div className="text-5xl mb-4">📦</div>
        <h2 className="text-xl font-semibold mb-2">{t('packing.title')}</h2>
        <p className="text-sm">בקרוב — מערכת האריזה המלאה</p>
      </div>
    </div>
  );
}
