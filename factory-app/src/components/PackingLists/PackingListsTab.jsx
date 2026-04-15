import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  subscribeToPackingLists,
  subscribeToBoxesByPacking,
  updatePackingListStatus,
} from '../../firebase/packing';
import { exportPackingToExcel } from '../../firebase/packingExport';
import { importPackingFromExcel } from '../../firebase/packingImport';

// ── Size columns in order ─────────────────────────────────────────────────────
const SIZES = ['51','52','53','54','55','56','57','58','59','60','61','62'];

// ─────────────────────────────────────────────────────────────────────────────
// PackingListsTab
// ─────────────────────────────────────────────────────────────────────────────
export default function PackingListsTab() {
  const { t } = useTranslation();

  const [packingLists, setPackingLists]       = useState([]);
  const [selectedPN,   setSelectedPN]         = useState(null); // selected packingNumber
  const [filter,       setFilter]             = useState('all');
  const [search,       setSearch]             = useState('');
  const [importBusy,   setImportBusy]         = useState(false);
  const [importMsg,    setImportMsg]          = useState(null);  // { ok, text }
  const [exportBusy,   setExportBusy]         = useState(false);
  const fileInputRef = useRef(null);

  // Subscribe to packing lists
  useEffect(() => {
    const unsub = subscribeToPackingLists(setPackingLists);
    return unsub;
  }, []);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = packingLists.filter(pl => {
    const matchFilter =
      filter === 'all' ||
      (filter === 'shipped' && pl.status === 'shipped') ||
      (filter === 'open'    && pl.status !== 'shipped');
    const matchSearch =
      !search ||
      String(pl.packingNumber).includes(search);
    return matchFilter && matchSearch;
  });

  // ── Import handler ────────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';            // allow re-selecting same file
    setImportBusy(true);
    setImportMsg(null);
    try {
      const result = await importPackingFromExcel(file);
      setImportMsg({
        ok: true,
        text: `ייבוא הצליח — ${result.imported} קרטונים (אריזות: ${result.packingNumbers.join(', ')})`,
      });
    } catch (err) {
      setImportMsg({ ok: false, text: `שגיאה בייבוא: ${err.message}` });
    } finally {
      setImportBusy(false);
    }
  }

  // ── Export handler ────────────────────────────────────────────────────────
  async function handleExport(packingNumber, allBoxes) {
    setExportBusy(true);
    try {
      exportPackingToExcel(allBoxes);
    } catch (err) {
      alert(`שגיאה בייצוא: ${err.message}`);
    } finally {
      setExportBusy(false);
    }
  }

  // ── Mark shipped handler ──────────────────────────────────────────────────
  async function handleMarkShipped(packingNumber, currentStatus) {
    const newStatus = currentStatus === 'shipped' ? 'open' : 'shipped';
    const date = newStatus === 'shipped' ? new Date().toISOString().split('T')[0] : null;
    await updatePackingListStatus(packingNumber, newStatus, date);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (selectedPN) {
    return (
      <PackingDetail
        packingNumber={selectedPN}
        packingLists={packingLists}
        onBack={() => setSelectedPN(null)}
        onExport={handleExport}
        onMarkShipped={handleMarkShipped}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">{t('packingLists.title')}</h1>

        <div className="flex items-center gap-2">
          {/* Import button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importBusy}
            className="btn-secondary btn-sm"
          >
            {importBusy ? '...מייבא' : `${t('common.import')} Excel`}
          </button>
        </div>
      </div>

      {/* ── Import message ──────────────────────────────────────────────── */}
      {importMsg && (
        <div
          className={`px-4 py-2 rounded text-sm font-medium ${
            importMsg.ok
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {importMsg.text}
          <button
            className="ms-3 text-xs underline opacity-70"
            onClick={() => setImportMsg(null)}
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filter pills */}
        {['all','open','shipped'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {t(`packingLists.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
          </button>
        ))}

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('packingLists.search')}
          className="input-field input-sm ms-auto w-40"
        />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">{t('packingLists.noData')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <Th>{t('packingLists.packingNumber')}</Th>
                <Th>{t('packingLists.createdAt')}</Th>
                <Th>{t('packingLists.status')}</Th>
                <Th>{t('packingLists.shipmentDate')}</Th>
                <Th>{t('packingLists.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(pl => (
                <PackingListRow
                  key={pl._id}
                  pl={pl}
                  onView={() => setSelectedPN(pl.packingNumber)}
                  onMarkShipped={() => handleMarkShipped(pl.packingNumber, pl.status)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PackingListRow
// ─────────────────────────────────────────────────────────────────────────────
function PackingListRow({ pl, onView, onMarkShipped }) {
  const { t } = useTranslation();
  const shipped = pl.status === 'shipped';

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <Td>
        <button
          onClick={onView}
          className="font-bold text-blue-600 hover:underline"
        >
          {pl.packingNumber}
        </button>
      </Td>
      <Td>{formatDate(pl.createdAt)}</Td>
      <Td>
        <span className={`badge ${shipped ? 'badge-green' : 'badge-blue'}`}>
          {shipped ? t('packingLists.shipped') : t('packingLists.open')}
        </span>
      </Td>
      <Td>{pl.shipmentDate || '—'}</Td>
      <Td>
        <div className="flex items-center gap-2">
          <button onClick={onView}
            className="inline-flex items-center px-2 py-1 text-xs rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
            {t('packingLists.viewBoxes')}
          </button>
          <button
            onClick={onMarkShipped}
            className={`inline-flex items-center px-2 py-1 text-xs rounded-lg font-medium cursor-pointer ${
              shipped
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {shipped ? t('packingLists.open') : t('packingLists.markShipped')}
          </button>
        </div>
      </Td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PackingDetail — shows all boxes for one packing number
// ─────────────────────────────────────────────────────────────────────────────
function PackingDetail({ packingNumber, packingLists, onBack, onExport, onMarkShipped }) {
  const { t }      = useTranslation();
  const [boxes, setBoxes] = useState([]);
  const [busy, setBusy]   = useState(false);

  const pl = packingLists.find(x => String(x.packingNumber) === String(packingNumber));
  const shipped = pl?.status === 'shipped';

  useEffect(() => {
    const unsub = subscribeToBoxesByPacking(packingNumber, setBoxes);
    return unsub;
  }, [packingNumber]);

  async function doExport() {
    setBusy(true);
    try {
      exportPackingToExcel(boxes);
    } catch (err) {
      alert(`שגיאה בייצוא: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Totals
  const totalBoxes = boxes.length;
  const totalItems = boxes.reduce((s, b) => s + (b.totalItems || 0), 0);

  // Size grand totals
  const sizeTotals = {};
  boxes.forEach(box => {
    Object.values(box.items || {}).forEach(item => {
      Object.entries(item.sizes || {}).forEach(([sz, qty]) => {
        sizeTotals[sz] = (sizeTotals[sz] || 0) + qty;
      });
    });
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="btn-secondary btn-sm">
          ← {t('packingLists.backToList')}
        </button>
        <h1 className="text-xl font-bold text-gray-800">
          {t('packingLists.packingNumber')} {packingNumber}
        </h1>
        {pl && (
          <span className={`badge ${shipped ? 'badge-green' : 'badge-blue'}`}>
            {shipped ? t('packingLists.shipped') : t('packingLists.open')}
          </span>
        )}
        <div className="ms-auto flex gap-2">
          <button
            onClick={doExport}
            disabled={busy || boxes.length === 0}
            className="btn-primary btn-sm"
          >
            {busy ? '...' : `${t('common.export')} Excel`}
          </button>
          <button
            onClick={() => onMarkShipped(packingNumber, pl?.status)}
            className={`btn-sm ${shipped ? 'btn-secondary' : 'btn-primary'}`}
          >
            {shipped ? t('packingLists.open') : t('packingLists.markShipped')}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
        <span><b>{t('packingLists.totalBoxes')}:</b> {totalBoxes}</span>
        <span><b>{t('packingLists.totalItems')}:</b> {totalItems}</span>
        {pl?.shipmentDate && (
          <span><b>{t('packingLists.shipmentDate')}:</b> {pl.shipmentDate}</span>
        )}
      </div>

      {/* Size totals */}
      {Object.keys(sizeTotals).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-gray-50">
                {SIZES.map(s => (
                  <th key={s} className="px-2 py-1 text-center font-semibold text-gray-600 border-b border-gray-200">{s}</th>
                ))}
                <th className="px-2 py-1 text-center font-semibold text-gray-800 border-b border-gray-200 border-s">
                  {t('common.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {SIZES.map(s => (
                  <td key={s} className="px-2 py-1 text-center text-gray-700">
                    {sizeTotals[s] || ''}
                  </td>
                ))}
                <td className="px-2 py-1 text-center font-bold text-gray-900 border-s">{totalItems}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Boxes list */}
      {boxes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">{t('packingLists.noData')}</div>
      ) : (
        <div className="space-y-3">
          {boxes.map(box => (
            <BoxCard key={box._id} box={box} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BoxCard — shows one box with its items
// ─────────────────────────────────────────────────────────────────────────────
function BoxCard({ box }) {
  const { t } = useTranslation();
  const items = Object.values(box.items || {});

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Box header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold">
        <span>{t('packingLists.boxNumber')} {box.boxNumber}</span>
        <span className="badge badge-gray">{box.boxSize}</span>
        <span className="ms-auto text-gray-500">
          {t('packingLists.totalItems')}: {box.totalItems ?? items.reduce((s,i) => s + (i.totalQuantity||0), 0)}
        </span>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <Th small>Model</Th>
              <Th small>H</Th>
              <Th small>Brim</Th>
              <Th small>Finish</Th>
              <Th small>Order</Th>
              {SIZES.map(s => <Th key={s} small>{s}</Th>)}
              <Th small>{t('common.total')}</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                <Td small>{item.model}</Td>
                <Td small>{item.height}</Td>
                <Td small>{item.brim}</Td>
                <Td small>{item.finishBrim}</Td>
                <Td small>{item.orderNumber}</Td>
                {SIZES.map(s => (
                  <Td key={s} small center>
                    {item.sizes?.[s] || ''}
                  </Td>
                ))}
                <Td small center><b>{item.totalQuantity || 0}</b></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
function Th({ children, small }) {
  return (
    <th className={`${small ? 'px-2 py-1' : 'px-3 py-2'} text-start font-semibold text-gray-600 whitespace-nowrap`}>
      {children}
    </th>
  );
}

function Td({ children, small, center }) {
  return (
    <td className={`${small ? 'px-2 py-1' : 'px-3 py-2'} text-gray-700 whitespace-nowrap ${center ? 'text-center' : ''}`}>
      {children}
    </td>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
