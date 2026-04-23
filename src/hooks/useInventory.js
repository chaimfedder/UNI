import { useState, useEffect, useMemo } from 'react';
import { subscribeToMovements } from '../firebase/inventory';

// flatItems — array of invoice item objects enriched with _invoiceId, _invoiceNumber, etc.
// Returns stockMap, movements, loadingMovements, getStock, getStockExcludingOrder.
export function useInventory(flatItems) {
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(true);

  useEffect(() => {
    const unsub = subscribeToMovements(data => {
      setMovements(data);
      setLoadingMovements(false);
    });
    return unsub;
  }, []);

  // Keyed by "materialType||weight||color||invoiceNumber"
  const stockMap = useMemo(() => {
    const map = new Map();

    const upsert = (materialType, weight, color, invoiceNumber) => {
      const key = `${materialType}||${weight}||${color}||${invoiceNumber}`;
      if (!map.has(key)) {
        map.set(key, { materialType, weight, color, invoiceNumber, totalIn: 0, totalOut: 0 });
      }
      return map.get(key);
    };

    (flatItems || []).forEach(item => {
      if (!item.materialType) return;
      upsert(
        item.materialType,
        item.weight       || '',
        item.color        || '',
        item._invoiceNumber || '',
      ).totalIn += parseFloat(item.quantity) || 0;
    });

    movements.forEach(mov => {
      if (!mov.materialType) return;
      upsert(
        mov.materialType,
        mov.weight        || '',
        mov.color         || '',
        mov.invoiceNumber || '',
      ).totalOut += parseFloat(mov.quantity) || 0;
    });

    map.forEach(v => { v.remaining = v.totalIn - v.totalOut; });

    return map;
  }, [flatItems, movements]);

  function getStock(materialType, weight, color, invoiceNumber) {
    return (
      stockMap.get(
        `${materialType || ''}||${weight || ''}||${color || ''}||${invoiceNumber || ''}`
      ) ?? { totalIn: 0, totalOut: 0, remaining: 0 }
    );
  }

  // Like getStock but ignores OUT movements that belong to a specific order.
  // Used in the material selector when editing an existing order — the order's
  // own previously-saved movements should not count against available stock.
  function getStockExcludingOrder(materialType, weight, color, invoiceNumber, excludeOrderNumber) {
    const stock = getStock(materialType, weight, color, invoiceNumber);
    if (!excludeOrderNumber) return stock;

    const excludedOut = movements
      .filter(
        m =>
          m.referenceId     === excludeOrderNumber &&
          m.materialType    === materialType &&
          (m.weight        || '') === (weight        || '') &&
          (m.color         || '') === (color         || '') &&
          (m.invoiceNumber || '') === (invoiceNumber || '')
      )
      .reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0);

    return {
      totalIn:   stock.totalIn,
      totalOut:  stock.totalOut  - excludedOut,
      remaining: stock.remaining + excludedOut,
    };
  }

  return { stockMap, movements, loadingMovements, getStock, getStockExcludingOrder };
}
