const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const fetch     = require('node-fetch');
const cors      = require('cors')({ origin: true });

admin.initializeApp();

exports.sendWhatsApp = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

      const id     = process.env.GREENAPI_ID;
      const token  = process.env.GREENAPI_TOKEN;
      const chatid = process.env.GREENAPI_CHATID;

      if (!id || !token || !chatid) {
        res.status(500).json({ error: 'Green API env vars missing in functions/.env' });
        return;
      }

      const { message, fileUrl, fileName } = req.body;
      const base = `https://api.green-api.com/waInstance${id}`;

      const endpoint = fileUrl
        ? `${base}/sendFileByUrl/${token}`
        : `${base}/sendMessage/${token}`;

      const body = fileUrl
        ? { chatId: chatid, urlFile: fileUrl, fileName: fileName || 'order.xlsx', caption: message || '' }
        : { chatId: chatid, message };

      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!apiRes.ok) {
        const err = await apiRes.text();
        res.status(500).json({ error: `Green API error: ${err}` });
        return;
      }

      res.json(await apiRes.json());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});
