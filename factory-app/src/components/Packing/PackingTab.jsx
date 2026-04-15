/**
 * PackingTab — embeds the full PK.HTML packing tool inside the React app.
 *
 * PK.HTML is served as a static file from the same origin (public/PK.HTML).
 * It has been patched with FirebaseSync calls so every action (complete box,
 * delete box, load backup, clear all) is automatically mirrored to Firestore.
 *
 * The iframe gets all available viewport height below the navbar so the packing
 * tool feels like a native part of the app.
 */
export default function PackingTab() {
  return (
    <div
      style={{ height: 'calc(100vh - 3.5rem - 2rem)' }}
      className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white"
    >
      <iframe
        src="/PK.HTML"
        title="Packing Tool"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
