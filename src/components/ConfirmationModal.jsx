import React from 'react';

const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'تایید',
  cancelText = 'انصراف',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[color:var(--bg)]/60 backdrop-blur-sm flex items-center justify-center z-50" aria-modal="true" role="dialog">
      <div className="w-full max-w-md m-4 rounded-xl border border-[color:var(--line)]/50 bg-[color:var(--surface)] p-6 shadow-xl animate-fade-in-scale">
        <h3 className="text-xl font-semibold mb-4 text-[color:var(--text)]">{title}</h3>
        <p className="app-muted mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-md bg-[color:var(--surface-2)]/35 text-[color:var(--text)]">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700">
            {confirmText}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-scale {
          0% { opacity: 0; transform: scale(.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-scale { animation: fade-in-scale 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ConfirmationModal;
