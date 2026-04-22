import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from './config';

export function subscribeToInvoices(callback) {
  return onSnapshot(collection(db, 'invoices'), snapshot => {
    const invoices = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
    invoices.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(invoices);
  });
}

export async function addInvoice(invoiceData) {
  const docRef = await addDoc(collection(db, 'invoices'), {
    ...invoiceData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateInvoice(id, data) {
  await updateDoc(doc(db, 'invoices', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoice(id, storagePath) {
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // file may already be deleted
    }
  }
  await deleteDoc(doc(db, 'invoices', id));
}

export async function uploadInvoicePDF(file, invoiceNumber) {
  const safeName = invoiceNumber
    ? invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
    : 'invoice';
  const storagePath = `invoices/${safeName}_${Date.now()}.pdf`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
  const url = await getDownloadURL(storageRef);
  return { url, storagePath };
}
