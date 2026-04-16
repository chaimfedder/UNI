const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const fetch     = require('node-fetch');

admin.initializeApp();

/**
 * Callable function: sends a WhatsApp message to the factory group via Green API.
 * Credentials are stored server-side in Firebase Functions config — never in client code.
 *
 * Set credentials once:
 *   firebase functions:config:set \
 *     greenapi.id="7107590626" \
 *     greenapi.token="YOUR_TOKEN" \
 *     greenapi.chatid="120363099281538294@g.us"
 */
exports.sendWhatsApp = functions.https.onCall(async (data) => {
  const cfg = functions.config().greenapi;
  if (!cfg?.id || !cfg?.token || !cfg?.chatid) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Green API config missing. Run: firebase functions:config:set greenapi.id=... greenapi.token=... greenapi.chatid=...'
    );
  }

  const url = `https://api.green-api.com/waInstance${cfg.id}/sendMessage/${cfg.token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: cfg.chatid, message: data.message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new functions.https.HttpsError('internal', `Green API error: ${body}`);
  }

  return await res.json();
});
