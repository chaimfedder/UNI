import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

export default function PackingTab() {
  const { t } = useTranslation();
  const [boxes, setBoxes]             = useState([]);
  const [packingLists, setPackingLists] = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'boxes'),        s => setBoxes(s.docs.map(d => ({ _id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'packingLists'), s => setPackingLists(s.docs.map(d => ({ _id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  // ── Time boundaries ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Sunday

    let boxesToday = 0, boxesWeek = 0, itemsToday = 0, itemsWeek = 0;

    boxes.forEach(box => {
      const ts = box.syncedAt?.seconds
        ? new Date(box.syncedAt.seconds * 1000)
        : box.timestamp ? new Date(box.timestamp) : null;

      if (!ts) return;
      const items = box.totalItems || 0;

      if (ts >= today)     { boxesToday++; itemsToday += items; }
      if (ts >= weekStart) { boxesWeek++;  itemsWeek  += items; }
    });

    const openLists    = packingLists.filter(pl => pl.status !== 'shipped').length;
    const shippedLists = packingLists.filter(pl => pl.status === 'shipped').length;
    const totalBoxes   = boxes.length;
    const totalItems   = boxes.reduce((s, b) => s + (b.totalItems || 0), 0);

    // Last 5 boxes by syncedAt
    const recent = [...boxes]
      .filter(b => b.syncedAt?.seconds || b.timestamp)
      .sort((a, b) => {
        const ta = a.syncedAt?.seconds || (a.timestamp ? new Date(a.timestamp).getTime() / 1000 : 0);
        const tb = b.syncedAt?.seconds || (b.timestamp ? new Date(b.timestamp).getTime() / 1000 : 0);
        return tb - ta;
      })
      .slice(0, 8);

    return { boxesToday, boxesWeek, itemsToday, itemsWeek, openLists, shippedLists, totalBoxes, totalItems, recent };
  }, [boxes, packingLists]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800">{t('packing.summary')}</h1>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="קרטונים היום"   value={stats.boxesToday}  sub={`${stats.itemsToday} פריטים`}  color="gold" />
        <StatCard label="קרטונים השבוע"  value={stats.boxesWeek}   sub={`${stats.itemsWeek} פריטים`}   color="gold" />
        <StatCard label="אריזות פתוחות"  value={stats.openLists}   sub="בעבודה"                        color="orange" />
        <StatCard label="אריזות שנשלחו"  value={stats.shippedLists} sub="מכל הזמן"                    color="green" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        <StatCard label="סה״כ קרטונים"  value={stats.totalBoxes} color="gray" />
        <StatCard label="סה״כ פריטים"   value={stats.totalItems} color="gray" />
      </div>

      {/* ── Open packing lists ───────────────────────────────────────────── */}
      {packingLists.filter(pl => pl.status !== 'shipped').length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">אריזות פתוחות</h2>
          <div className="flex flex-wrap gap-2">
            {packingLists
              .filter(pl => pl.status !== 'shipped')
              .sort((a, b) => parseInt(b.packingNumber) - parseInt(a.packingNumber))
              .map(pl => (
                <div key={pl._id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border" style={{ backgroundColor: '#FBF5DC', borderColor: '#E8C84A' }}>
                  <span className="font-bold" style={{ color: '#A07830' }}>#{pl.packingNumber}</span>
                  {pl.totalBoxes !== undefined && (
                    <span className="text-xs" style={{ color: '#C9A84C' }}>{pl.totalBoxes} קרטונים</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Recently packed boxes ────────────────────────────────────────── */}
      {stats.recent.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm">קרטונים אחרונים שנארזו</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-start">אריזה</th>
                  <th className="px-3 py-2 text-start">קרטון</th>
                  <th className="px-3 py-2 text-start">גודל</th>
                  <th className="px-3 py-2 text-start">פריטים</th>
                  <th className="px-3 py-2 text-start">שעה</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map(box => {
                  const ts = box.syncedAt?.seconds
                    ? new Date(box.syncedAt.seconds * 1000)
                    : box.timestamp ? new Date(box.timestamp) : null;
                  return (
                    <tr key={box._id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold" style={{ color: '#C9A84C' }}>#{box.packingNumber}</td>
                      <td className="px-3 py-2 text-gray-700">{box.boxNumber}</td>
                      <td className="px-3 py-2">
                        <span className="badge badge-gray">{box.boxSize}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{box.totalItems}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        {ts ? ts.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {boxes.length === 0 && (
        <div className="text-center py-16 text-gray-400">אין נתונים עדיין</div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  const colors = {
    gold:   'border',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green:  'bg-green-50  border-green-200  text-green-700',
    gray:   'bg-gray-50   border-gray-200   text-gray-700',
  };
  const goldStyle = color === 'gold' ? { backgroundColor: '#FBF5DC', borderColor: '#E8C84A', color: '#A07830' } : {};
  return (
    <div className={`border rounded-xl px-4 py-3 ${colors[color] || colors.gray}`} style={goldStyle}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}
