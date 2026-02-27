import React, { useEffect, useState } from 'react';
import { useTeams } from './hooks/useTeams.js';
import TeamCard from './components/TeamCard.jsx';
import AddTeamModal from './components/AddTeamModal.jsx';
import EditLeaderModal from './components/EditLeaderModal.jsx';
import ConfirmationModal from './components/ConfirmationModal.jsx';
import ScheduleTable from './components/ScheduleTable.jsx';
import AnalyticsTable from './components/AnalyticsTable.jsx';
import { PlusIcon, UsersIcon } from './components/icons/Icons.jsx';

const THEME_KEY = 'app_theme_mode_v1';

const CalendarIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const ReportIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9a3 3 0 013 3v10.5a3 3 0 01-3 3h-9a3 3 0 01-3-3V6.75a3 3 0 013-3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5M9.75 13.5h4.5M9.75 17.25h2.25" />
  </svg>
);

const ThemeIcon = ({ className, dark }) => (
  dark ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 15.75A9 9 0 1112 2.25a7.5 7.5 0 009.75 13.5z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m8.25-9H21m-18 0h1.5M18.364 5.636l-1.06 1.06M6.697 17.303l-1.06 1.06m0-12.727l1.06 1.06m10.607 10.607l1.06 1.06M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
);

const App = () => {
  const { teams, addTeam, updateTeam, deleteTeam, addMember, deleteMember } = useTeams();
  const [viewMode, setViewMode] = useState('teams');
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'light';
    } catch {
      return 'light';
    }
  });

  const [isAddTeamModalOpen, setAddTeamModalOpen] = useState(false);
  const [editingLeaderTeam, setEditingLeaderTeam] = useState(null);
  const [deletingTeam, setDeletingTeam] = useState(null);
  const [deletingMember, setDeletingMember] = useState(null);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const handleUpdateLeader = (teamId, newLeader) => {
    const teamToUpdate = teams.find((t) => t.id === teamId);
    if (teamToUpdate) updateTeam({ ...teamToUpdate, leader: newLeader });
    setEditingLeaderTeam(null);
  };

  const handleDeleteTeam = () => {
    if (!deletingTeam) return;
    deleteTeam(deletingTeam.id);
    setDeletingTeam(null);
  };

  const handleDeleteMember = () => {
    if (!deletingMember) return;
    deleteMember(deletingMember.teamId, deletingMember.memberName);
    setDeletingMember(null);
  };

  return (
    <div className="min-h-screen text-[color:var(--text)] transition-colors duration-300 font-sans">
      <header className="sticky top-0 z-50 border-b border-[color:var(--line)]/55 bg-[color:var(--surface)]/75 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg app-surface">
                <UsersIcon className="h-6 w-6 text-[color:var(--primary)]" />
              </div>
              <h1 className="text-2xl font-bold text-[color:var(--text)]">سامانه شیفت‌بندی</h1>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-2">
              <div className="flex p-1 rounded-xl app-surface">
                <button
                  onClick={() => setViewMode('teams')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'teams'
                      ? 'bg-[color:var(--primary)] text-[#F7F8F0] shadow'
                      : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                  }`}
                >
                  <UsersIcon className="h-4 w-4" />
                  مدیریت تیم‌ها
                </button>
                <button
                  onClick={() => setViewMode('schedule')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'schedule'
                      ? 'bg-[color:var(--primary)] text-[#F7F8F0] shadow'
                      : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                  }`}
                >
                  <CalendarIcon className="h-4 w-4" />
                  جدول شیفت
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'analytics'
                      ? 'bg-[color:var(--primary)] text-[#F7F8F0] shadow'
                      : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                  }`}
                >
                  <ReportIcon className="h-4 w-4" />
                  گزارش دیتا
                </button>
              </div>

              <button
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                className="flex items-center gap-2 px-3 py-2 rounded-xl app-surface text-[color:var(--text)] hover:bg-[color:var(--surface-2)]/30 transition-colors"
              >
                <ThemeIcon className="h-5 w-5" dark={theme === 'dark'} />
                <span className="text-sm font-medium">{theme === 'dark' ? 'دارک' : 'لایت'}</span>
              </button>

              {viewMode === 'teams' && (
                <button
                  onClick={() => setAddTeamModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl shadow app-primary-btn transition-all hover:opacity-95"
                >
                  <PlusIcon className="h-5 w-5" />
                  <span className="hidden sm:inline">تیم جدید</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main-bg">
  <div className="app-main-content container w-full mx-auto px-4 sm:px-6 lg:px-0 py-8">
    {viewMode === 'teams' ? (
      teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-fade-in-up">
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
        <div className="text-center py-20 rounded-xl app-surface">
          <p className="text-xl app-muted">هیچ تیمی یافت نشد. برای شروع یک تیم جدید اضافه کنید.</p>
        </div>
      )
    ) : viewMode === 'schedule' ? (
      <div className="animate-fade-in-up">
        <ScheduleTable />
      </div>
    ) : (
      <div className="animate-fade-in-up">
        <AnalyticsTable />
      </div>
    )}
  </div>
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
