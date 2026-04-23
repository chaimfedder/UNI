import {
  collection,
  doc,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// Subscribe to all OUT movements in real-time.
// Note: if Firestore returns a "missing index" error, create a composite index
// on inventoryMovements (type ASC) in the Firebase console.
export function subscribeToMovements(callback) {
  return onSnapshot(
    query(collection(db, 'inventoryMovements'), where('type', '==', 'OUT')),
    snapshot => {
      callback(snapshot.docs.map(d => ({ _id: d.id, ...d.data() })));
    }
  );
}

// Atomically replaces all OUT movements for an order.
// Deletes old docs and writes new ones in a single batch — no partial state possible.
export async function saveOrderMovements(orderNumber, brand, materials) {
  const q = query(
    collection(db, 'inventoryMovements'),
    where('referenceId', '==', orderNumber),
    where('type', '==', 'OUT')
  );
  const snap = await getDocs(q);

  const batch = writeBatch(db);

  // Delete all existing movements for this order
  snap.docs.forEach(d => batch.delete(d.ref));

  // Create new movements
  (materials || []).forEach(mat => {
    if (!mat.materialType || !(Number(mat.quantity) > 0)) return;
    const ref = doc(collection(db, 'inventoryMovements'));
    batch.set(ref, {
      type: 'OUT',
      materialType: mat.materialType || '',
      weight: mat.weight || '',
      color: mat.color || '',
      quantity: Number(mat.quantity),
      source: 'order',
      referenceId: orderNumber,
      orderNumber: orderNumber,
      invoiceNumber: mat.invoiceNumber || '',
      confNumber: mat.confNumber || '',
      brand: brand || '',
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

// Removes all OUT movements for a given order (used on order delete).
export async function deleteOrderMovements(orderNumber) {
  const q = query(
    collection(db, 'inventoryMovements'),
    where('referenceId', '==', orderNumber),
    where('type', '==', 'OUT')
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// One-shot fetch of OUT movements for a single order (for display in order detail).
export async function getOrderMovements(orderNumber) {
  const q = query(
    collection(db, 'inventoryMovements'),
    where('referenceId', '==', orderNumber),
    where('type', '==', 'OUT')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}
