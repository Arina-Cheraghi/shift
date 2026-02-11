
import React, { useState } from 'react';

const EditLeaderModal = ({ team, onClose, onSave }) => {
    const [leaderName, setLeaderName] = useState(team.leader === 'تعیین نشده' ? '' : team.leader);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (leaderName.trim()) {
            onSave(team.id, leaderName.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4 animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">ویرایش سرگروه «{team.name}»</h3>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="leaderName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        نام سرگروه
                    </label>
                    <input
                        id="leaderName"
                        type="text"
                        value={leaderName}
                        onChange={(e) => setLeaderName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200"
                        autoFocus
                    />
                    <div className="mt-6 flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                        >
                            انصراف
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed transition-colors"
                            disabled={!leaderName.trim()}
                        >
                            ذخیره
                        </button>
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
