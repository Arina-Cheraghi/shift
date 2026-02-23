import React, { useEffect, useRef, useState } from 'react';
import { DotsVerticalIcon, EditIcon, PlusIcon, TrashIcon, UserIcon } from './icons/Icons.jsx';

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
    if (isAddingMember) addMemberInputRef.current?.focus();
  }, [isAddingMember]);

  const handleAddMember = (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    onAddMember(team.id, newMemberName.trim());
    setNewMemberName('');
    setIsAddingMember(false);
  };

  return (
    <div className="rounded-2xl border border-[color:var(--line)]/55 bg-[color:var(--surface)]/80 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col backdrop-blur-sm">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-[color:var(--text)]">{team.name}</h2>
            <div className="flex items-center gap-2 mt-2 text-[color:var(--muted)]">
              <UserIcon className="h-5 w-5" />
              <span className="font-medium">{team.leader}</span>
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-[color:var(--muted)] hover:text-[color:var(--primary)] rounded-full hover:bg-[color:var(--surface-2)]/35 transition-colors"
              aria-label="گزینه‌ها"
            >
              <DotsVerticalIcon className="h-6 w-6" />
            </button>

            {isMenuOpen && (
              <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg z-20 border border-[color:var(--line)]/45 bg-[color:var(--surface)] animate-fade-in-down">
                <div className="py-1">
                  <button
                    onClick={() => {
                      onEditLeader();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-[color:var(--text)] hover:bg-[color:var(--surface-2)]/30 transition-colors"
                  >
                    <EditIcon className="h-5 w-5" />
                    <span>ویرایش سرگروه</span>
                  </button>
                  <button
                    onClick={() => {
                      onDeleteTeam();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <TrashIcon className="h-5 w-5" />
                    <span>حذف تیم</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[color:var(--line)]/35 pt-4">
          <h3 className="font-semibold mb-3 text-[color:var(--text)]">
            اعضا ({team.members.length})
          </h3>
          <ul className="space-y-1 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
            {team.members.map((member, index) => (
              <li
                key={index}
                className="flex justify-between items-center group text-[color:var(--text)] rounded-md hover:bg-[color:var(--surface-2)]/24 p-2 -ml-2 transition-colors"
              >
                <span>{member}</span>
                <button
                  onClick={() => onDeleteMember(member)}
                  className="p-1 text-[color:var(--muted)] hover:text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`حذف ${member}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}

            {team.members.length === 0 && (
              <li className="app-muted text-sm p-2">هیچ عضوی در این تیم وجود ندارد.</li>
            )}
          </ul>
        </div>
      </div>

      <div className={`mt-auto p-4 border-t border-[color:var(--line)]/35 transition-all ${isAddingMember ? 'bg-[color:var(--surface-2)]/20' : 'bg-transparent'}`}>
        {isAddingMember ? (
          <form onSubmit={handleAddMember} className="w-full animate-fade-in-up">
            <label htmlFor={`add-member-${team.id}`} className="sr-only">نام عضو جدید</label>
            <input
              id={`add-member-${team.id}`}
              ref={addMemberInputRef}
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="نام عضو جدید را وارد کنید..."
              className="w-full px-3 py-2 text-sm rounded-md border border-[color:var(--line)]/60 bg-[color:var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-2)]"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setIsAddingMember(false)}
                className="px-3 py-1 text-sm rounded-md bg-[color:var(--surface-2)]/30 text-[color:var(--text)]"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={!newMemberName.trim()}
                className="px-3 py-1 text-sm rounded-md app-primary-btn disabled:opacity-55 disabled:cursor-not-allowed"
              >
                ذخیره
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingMember(true)}
            className="w-full flex items-center justify-center gap-2 text-sm text-[color:var(--primary)] hover:opacity-80 font-semibold transition-colors group"
          >
            <span className="p-1 rounded-full bg-[color:var(--surface-2)]/35 group-hover:bg-[color:var(--surface-2)]/50 transition-colors">
              <PlusIcon className="h-4 w-4" />
            </span>
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

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; margin-top: 8px; margin-bottom: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: color-mix(in srgb, var(--primary) 45%, var(--surface)); }
      `}</style>
    </div>
  );
};

export default TeamCard;
