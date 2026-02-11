
import React, { useState, useRef, useEffect } from 'react';
import { EditIcon, TrashIcon, UserIcon, PlusIcon, DotsVerticalIcon } from './icons/Icons.jsx';

const TeamCard = ({ team, onEditLeader, onDeleteTeam, onAddMember, onDeleteMember }) => {
    const [newMemberName, setNewMemberName] = useState('');
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const addMemberInputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    useEffect(() => {
        if (isAddingMember) {
            addMemberInputRef.current?.focus();
        }
    }, [isAddingMember]);

    const handleAddMember = (e) => {
        e.preventDefault();
        if (newMemberName.trim()) {
            onAddMember(team.id, newMemberName.trim());
            setNewMemberName('');
            setIsAddingMember(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/90 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200/80 dark:border-slate-700/50 flex flex-col">
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{team.name}</h2>
                        <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400">
                            <UserIcon className="h-5 w-5" />
                            <span className="font-medium">{team.leader}</span>
                        </div>
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                            aria-label="گزینه‌ها"
                        >
                            <DotsVerticalIcon className="h-6 w-6" />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20 transition-all origin-top-right animate-fade-in-down">
                                <div className="py-1">
                                    <button
                                        onClick={() => { onEditLeader(); setIsMenuOpen(false); }}
                                        className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                                    >
                                        <EditIcon className="h-5 w-5" />
                                        <span>ویرایش سرگروه</span>
                                    </button>
                                    <button
                                        onClick={() => { onDeleteTeam(); setIsMenuOpen(false); }}
                                        className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                        <span>حذف تیم</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-slate-200/80 dark:border-slate-700/50 pt-4">
                    <h3 className="font-semibold mb-3 text-slate-700 dark:text-slate-300">اعضا ({team.members.length})</h3>
                    <ul className="space-y-1 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                        {team.members.map((member, index) => (
                            <li key={index} className="flex justify-between items-center group text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 p-2 -ml-2 transition-colors">
                                <span>{member}</span>
                                <button
                                    onClick={() => onDeleteMember(member)}
                                    className="p-1 text-slate-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label={`حذف ${member}`}
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                        {team.members.length === 0 && (
                            <li className="text-slate-400 dark:text-slate-500 text-sm p-2">هیچ عضوی در این تیم وجود ندارد.</li>
                        )}
                    </ul>
                </div>
            </div>
            
            <div className={`mt-auto p-4 border-t border-slate-200/80 dark:border-slate-700/50 transition-all ${isAddingMember ? 'bg-slate-100/50 dark:bg-slate-800/50' : 'bg-transparent'}`}>
                {isAddingMember ? (
                     <form onSubmit={handleAddMember} className="w-full transition-all animate-fade-in-up">
                        <label htmlFor={`add-member-${team.id}`} className="sr-only">نام عضو جدید</label>
                        <input
                            id={`add-member-${team.id}`}
                            ref={addMemberInputRef}
                            type="text"
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            placeholder="نام عضو جدید را وارد کنید..."
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200"
                        />
                         <div className="flex justify-end gap-2 mt-3">
                             <button type="button" onClick={() => setIsAddingMember(false)} className="px-3 py-1 text-sm text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">انصراف</button>
                             <button type="submit" disabled={!newMemberName.trim()} className="px-3 py-1 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:bg-emerald-400 dark:disabled:bg-emerald-800 disabled:cursor-not-allowed">ذخیره</button>
                         </div>
                    </form>
                ) : (
                    <button
                        onClick={() => setIsAddingMember(true)}
                        className="w-full flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold transition-colors group"
                    >
                        <span className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900 transition-colors"><PlusIcon className="h-4 w-4" /></span>
                        <span>افزودن عضو</span>
                    </button>
                )}
            </div>
             <style>{`
                @keyframes fade-in-down {
                    0% { opacity: 0; transform: translateY(-10px) scale(0.95); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-down { animation: fade-in-down 0.15s ease-out forwards; }

                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.2s ease-out forwards; }
                
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                    margin-top: 8px;
                    margin-bottom: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: transparent;
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #d1d5db; /* gray-300 */
                }
                .dark .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #4b5563; /* gray-600 */
                }

            `}</style>
        </div>
    );
};

export default TeamCard;
