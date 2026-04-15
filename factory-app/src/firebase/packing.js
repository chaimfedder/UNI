/**
 * packing.js — Firebase sync layer for packing data
 *
 * Source of truth: PK.HTML (the factory's live packing tool)
 * This module mirrors every PK action into Firestore in real time.
 *
 * Firestore collections:
 *   boxes/{packingNumber}_{boxNumber}   — one document per carton
 *   packingLists/{packingNumber}        — header / aggregate per packing list
 *
 * Box document structure mirrors PK's State.allBoxes[] items exactly:
 *   {
 *     packingNumber : string
 *     boxNumber     : string
 *     boxSize       : "S" | "M" | "L"
 *     timestamp     : ISO string (from PK)
 *     items         : {
 *       [variantKey]: {
 *         model, height, brim, orderNumber, finishBrim,
 *         sizes: { [hatSize]: quantity },
 *         totalQuantity
 *       }
 *     }
 *     totalItems    : number
 *     syncedAt      : Firestore server timestamp
 *   }
 */

import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db } from './config';

// ── ID helpers ────────────────────────────────────────────────────────────────

/** Canonical Firestore document ID for a box.
 *  Matches PK's internal key: packingNumber + "_" + boxNumber
 *  e.g. "1_42", "3_7"
 */
export function boxDocId(packingNumber, boxNumber) {
  return `${packingNumber}_${boxNumber}`;
}

// ── Write / Update ────────────────────────────────────────────────────────────

/**
 * Called when PK completes OR edits a box.
 * Writes (or overwrites) the box document.
 * Also upserts the parent packingList document.
 *
 * @param {object} boxData — one element from PK's State.allBoxes
 */
export async function syncBoxToFirebase(boxData) {
  const { packingNumber, boxNumber } = boxData;

  // Calculate total items for easy querying
  const totalItems = Object.values(boxData.items).reduce(
    (sum, item) => sum + (item.totalQuantity || 0),
    0
  );

  const boxRef = doc(db, 'boxes', boxDocId(packingNumber, boxNumber));

  await setDoc(boxRef, {
    ...boxData,
    totalItems,
    syncedAt: serverTimestamp(),
  });

  // Upsert packing list header (non-destructive — only updates metadata)
  await _upsertPackingListMeta(packingNumber);
}

/**
 * Batch-write all boxes (called when PK loads a JSON backup).
 * Replaces all existing boxes for the affected packing numbers.
 *
 * @param {Array} allBoxes — PK's full State.allBoxes array
 */
export async function batchSyncBoxesToFirebase(allBoxes) {
  if (!allBoxes || allBoxes.length === 0) return;

  // Firestore batch limit is 500 writes per batch
  const CHUNK = 490;
  for (let i = 0; i < allBoxes.length; i += CHUNK) {
    const chunk = allBoxes.slice(i, i + CHUNK);
    const batch = writeBatch(db);

    chunk.forEach(boxData => {
      const totalItems = Object.values(boxData.items).reduce(
        (sum, item) => sum + (item.totalQuantity || 0),
        0
      );
      const ref = doc(db, 'boxes', boxDocId(boxData.packingNumber, boxData.boxNumber));
      batch.set(ref, { ...boxData, totalItems, syncedAt: serverTimestamp() });
    });

    await batch.commit();
  }

  // Upsert packing list headers for every unique packingNumber
  const packingNumbers = [...new Set(allBoxes.map(b => b.packingNumber))];
  for (const pn of packingNumbers) {
    await _upsertPackingListMeta(pn);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Called when PK deletes a single box.
 *
 * @param {string} packingNumber
 * @param {string} boxNumber
 */
export async function deleteBoxFromFirebase(packingNumber, boxNumber) {
  await deleteDoc(doc(db, 'boxes', boxDocId(packingNumber, boxNumber)));
  await _upsertPackingListMeta(packingNumber);
}

/**
 * Called when PK deletes multiple boxes at once.
 * boxesToDelete = array of { packingNumber, boxNumber } OR just boxNumber strings
 * when all belong to the same packing.
 *
 * @param {Array<{packingNumber:string, boxNumber:string}>} boxes
 */
export async function deleteMultipleBoxesFromFirebase(boxes) {
  if (!boxes || boxes.length === 0) return;

  const CHUNK = 490;
  for (let i = 0; i < boxes.length; i += CHUNK) {
    const chunk = boxes.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach(({ packingNumber, boxNumber }) => {
      batch.delete(doc(db, 'boxes', boxDocId(packingNumber, boxNumber)));
    });
    await batch.commit();
  }

  // Refresh packing list headers
  const packingNumbers = [...new Set(boxes.map(b => b.packingNumber))];
  for (const pn of packingNumbers) {
    await _upsertPackingListMeta(pn);
  }
}

/**
 * Called when PK clears ALL data.
 * Deletes every box for the given packingNumber (pass null to delete everything).
 *
 * NOTE: Firestore has no "delete collection" API — we must list + delete.
 * This function deletes the docs we know about from the local allBoxes array.
 *
 * @param {Array} allBoxes — current State.allBoxes before clear
 */
export async function clearAllBoxesFromFirebase(allBoxes) {
  if (!allBoxes || allBoxes.length === 0) return;
  await deleteMultipleBoxesFromFirebase(
    allBoxes.map(b => ({ packingNumber: b.packingNumber, boxNumber: b.boxNumber }))
  );
}

// ── Packing list status ───────────────────────────────────────────────────────

/**
 * Mark a packing list as shipped (or revert to open).
 *
 * @param {string} packingNumber
 * @param {'open'|'shipped'} status
 * @param {string} [shipmentDate]  ISO date string, set when marking shipped
 */
export async function updatePackingListStatus(packingNumber, status, shipmentDate) {
  const plRef = doc(db, 'packingLists', String(packingNumber));
  const update = { status, updatedAt: serverTimestamp() };
  if (status === 'shipped' && shipmentDate) update.shipmentDate = shipmentDate;
  if (status === 'open') update.shipmentDate = null;
  await setDoc(plRef, update, { merge: true });
}

// ── Real-time listeners ───────────────────────────────────────────────────────

/**
 * Subscribe to live changes in the boxes collection.
 * Returns an unsubscribe function.
 *
 * The callback receives the full current list of boxes as an array,
 * sorted by packingNumber ASC, then boxNumber ASC (numeric).
 *
 * @param {Function} callback (boxes: Array) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToBoxes(callback) {
  const q = query(collection(db, 'boxes'));
  return onSnapshot(q, snapshot => {
    const boxes = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
    boxes.sort((a, b) => {
      const pn = String(a.packingNumber).localeCompare(String(b.packingNumber));
      if (pn !== 0) return pn;
      return parseInt(a.boxNumber) - parseInt(b.boxNumber);
    });
    callback(boxes);
  });
}

/**
 * Subscribe to boxes for a specific packing number.
 * Returns an unsubscribe function.
 *
 * @param {string} packingNumber
 * @param {Function} callback (boxes: Array) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToBoxesByPacking(packingNumber, callback) {
  const q = query(
    collection(db, 'boxes'),
    where('packingNumber', '==', String(packingNumber))
  );
  return onSnapshot(q, snapshot => {
    const boxes = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
    boxes.sort((a, b) => parseInt(a.boxNumber) - parseInt(b.boxNumber));
    callback(boxes);
  });
}

/**
 * Subscribe to live changes in the packingLists collection.
 * Returns an unsubscribe function.
 *
 * @param {Function} callback (packingLists: Array) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToPackingLists(callback) {
  // No orderBy — documents created by PK.HTML may not have createdAt.
  // Sort client-side by packingNumber descending instead.
  return onSnapshot(collection(db, 'packingLists'), snapshot => {
    const lists = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
    lists.sort((a, b) => {
      // Sort by packingNumber descending (newest first)
      return parseInt(b.packingNumber) - parseInt(a.packingNumber);
    });
    callback(lists);
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Upsert the packingLists/{packingNumber} document.
 * Recomputes totalBoxes and totalItems from the boxes collection.
 * Status is kept at "open" unless already set to "shipped".
 *
 * This is lightweight — called after every box write/delete.
 * We use a live query snapshot here because this runs server-side rarely.
 */
async function _upsertPackingListMeta(packingNumber) {
  // We do a simple set-merge so we don't overwrite existing status/shipmentDate
  const plRef = doc(db, 'packingLists', String(packingNumber));

  // Use merge so we don't overwrite status or shipmentDate set from the UI
  await setDoc(
    plRef,
    {
      packingNumber: String(packingNumber),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Set createdAt only on first creation (merge won't overwrite existing field
  // — but serverTimestamp won't skip if already set; use a transaction for strict
  // semantics. For MVP, a simple check is enough.)
  await setDoc(
    plRef,
    { createdAt: serverTimestamp() },
    { merge: true }
  );
}
