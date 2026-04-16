const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const fetch     = require('node-fetch');

admin.initializeApp();

exports.sendWhatsApp = functions.https.onCall(async (data) => {
  const id     = process.env.GREENAPI_ID;
  const token  = process.env.GREENAPI_TOKEN;
  const chatid = process.env.GREENAPI_CHATID;

  if (!id || !token || !chatid) {
    throw new functions.https.HttpsError('failed-precondition', 'Green API env vars missing in functions/.env');
  }

  const base = `https://api.green-api.com/waInstance${id}`;

  const endpoint = data.fileUrl
    ? `${base}/sendFileByUrl/${token}`
    : `${base}/sendMessage/${token}`;

  const body = data.fileUrl
    ? { chatId: chatid, urlFile: data.fileUrl, fileName: data.fileName || 'order.xlsx', caption: data.message || '' }
    : { chatId: chatid, message: data.message };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new functions.https.HttpsError('internal', `Green API error: ${err}`);
  }

  return await res.json();
});
