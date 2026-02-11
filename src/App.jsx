
import React, { useState } from 'react';
import { useTeams } from './hooks/useTeams.js';
import TeamCard from './components/TeamCard.jsx';
import AddTeamModal from './components/AddTeamModal.jsx';
import EditLeaderModal from './components/EditLeaderModal.jsx';
import ConfirmationModal from './components/ConfirmationModal.jsx';
import { PlusIcon, UsersIcon } from './components/icons/Icons.jsx';

const App = () => {
    const { teams, addTeam, updateTeam, deleteTeam, addMember, deleteMember } = useTeams();
    
    const [isAddTeamModalOpen, setAddTeamModalOpen] = useState(false);
    const [editingLeaderTeam, setEditingLeaderTeam] = useState(null);
    const [deletingTeam, setDeletingTeam] = useState(null);
    const [deletingMember, setDeletingMember] = useState(null);

    const handleUpdateLeader = (teamId, newLeader) => {
        const teamToUpdate = teams.find(t => t.id === teamId);
        if (teamToUpdate) {
            updateTeam({ ...teamToUpdate, leader: newLeader });
        }
        setEditingLeaderTeam(null);
    };

    const handleDeleteTeam = () => {
        if (deletingTeam) {
            deleteTeam(deletingTeam.id);
            setDeletingTeam(null);
        }
    };
    
    const handleDeleteMember = () => {
        if (deletingMember) {
            deleteMember(deletingMember.teamId, deletingMember.memberName);
            setDeletingMember(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300">
            <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <UsersIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">داشبورد مدیریت تیم</h1>
                    </div>
                    <button
                        onClick={() => setAddTeamModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75 transition-all transform hover:scale-105"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span className="hidden sm:inline">تیم جدید</span>
                    </button>
                </div>
            </header>
            
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {teams.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {teams.map((team) => (
                            <TeamCard
                                key={team.id}
                                team={team}
                                onEditLeader={() => setEditingLeaderTeam(team)}
                                onDeleteTeam={() => setDeletingTeam(team)}
                                onAddMember={addMember}
                                onDeleteMember={(memberName) => setDeletingMember({ teamId: team.id, memberName })}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <p className="text-xl text-slate-500 dark:text-slate-400">هیچ تیمی یافت نشد. برای شروع یک تیم جدید اضافه کنید!</p>
                    </div>
                )}
            </main>

            {isAddTeamModalOpen && (
                <AddTeamModal
                    onClose={() => setAddTeamModalOpen(false)}
                    onAddTeam={(name) => {
                        addTeam(name);
                        setAddTeamModalOpen(false);
                    }}
                />
            )}

            {editingLeaderTeam && (
                <EditLeaderModal
                    team={editingLeaderTeam}
                    onClose={() => setEditingLeaderTeam(null)}
                    onSave={handleUpdateLeader}
                />
            )}
            
            {deletingTeam && (
                <ConfirmationModal
                    isOpen={!!deletingTeam}
                    title="حذف تیم"
                    message={`آیا مطمئن هستید که می‌خواهید تیم «${deletingTeam.name}» را حذف کنید؟ این عمل قابل بازگشت نیست.`}
                    onConfirm={handleDeleteTeam}
                    onCancel={() => setDeletingTeam(null)}
                    confirmText="حذف"
                />
            )}
            
            {deletingMember && (
                <ConfirmationModal
                    isOpen={!!deletingMember}
                    title="حذف عضو"
                    message={`آیا مطمئن هستید که می‌خواهید «${deletingMember.memberName}» را از تیم حذف کنید؟`}
                    onConfirm={handleDeleteMember}
                    onCancel={() => setDeletingMember(null)}
                    confirmText="حذف"
                />
            )}
        </div>
    );
};

export default App;
