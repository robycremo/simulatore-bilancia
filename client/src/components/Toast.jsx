// Notifiche temporanee per i messaggi di errore inviati dal server.
export default function Toast({ errors }) {
  if (!errors.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {errors.map((e) => (
        <div key={e.id} className="toast">
          {e.message}
        </div>
      ))}
    </div>
  );
}
