import React, { useState } from 'react';

const EditLeaderModal = ({ team, onClose, onSave }) => {
  const [leaderName, setLeaderName] = useState(team.leader === 'تعیین نشده' ? '' : team.leader);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (leaderName.trim()) onSave(team.id, leaderName.trim());
  };

  return (
    <div className="fixed inset-0 bg-[color:var(--bg)]/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="w-full max-w-md m-4 rounded-xl border border-[color:var(--line)]/50 bg-[color:var(--surface)] p-6 shadow-xl animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold mb-4 text-[color:var(--text)]">ویرایش سرگروه «{team.name}»</h3>
        <form onSubmit={handleSubmit}>
          <label htmlFor="leaderName" className="block text-sm font-medium app-muted mb-2">نام سرگروه</label>
          <input
            id="leaderName"
            type="text"
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[color:var(--line)]/65 bg-[color:var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-2)]"
            autoFocus
          />
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-[color:var(--surface-2)]/35 text-[color:var(--text)]">انصراف</button>
            <button type="submit" className="px-4 py-2 rounded-md app-primary-btn disabled:opacity-55" disabled={!leaderName.trim()}>ذخیره</button>
          </div>
        </form>
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

export default EditLeaderModal;
