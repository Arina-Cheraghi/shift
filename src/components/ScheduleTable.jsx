




import React, { useState, useEffect, useMemo } from 'react';
import {
  generateSchedule,
  deepClone,
  getNextTextShiftStartIndex,
  APPROVED_SHIFT_LEADERS,
  TEAM_LEAD_NAMES
} from '../utils/schedulerLogic';
import { useTeams } from '../hooks/useTeams';
import { ExcelIcon } from './icons/Icons.jsx';

const JALAALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const STATE_KEY = "shift_scheduler_state_v1";
const EDITS_KEY_PREFIX = "shift_schedule_edits_";

const getEditsKey = (year, month) => `${EDITS_KEY_PREFIX}${year}_${String(month).padStart(2, '0')}`;

const isThu = (day) => day?.dayName === 'پنج‌شنبه';
const isFri = (day) => day?.dayName === 'جمعه';
const isWeekendDay = (day) => isThu(day) || isFri(day);

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const MEMBER_ROLE_OPTIONS = [
  { value: 'text', label: 'text' },
  { value: 'inbound', label: 'inbound' },
  { value: 'outbound', label: 'outbound' },
  { value: 'inbound-option', label: 'inbound-option' },
  { value: 'shift', label: 'shift' },
  { value: 'oncall', label: 'oncall' },
  { value: 'off', label: 'off' },
  { value: 'ot', label: 'OT', requiresTeamOff: true },
];

const SLOT_TYPES = new Set(['A', 'B', 'C', 'D', 'E', 'F']);

const buildSlotOptions = (slotLetter) => {
  const suffix = slotLetter.toLowerCase();
  return [
    { value: `inbound-${suffix}`, label: `inbound-${suffix}` },
    { value: `outbound-${suffix}`, label: `outbound-${suffix}` },
    { value: `text1-${suffix}`, label: `text1-${suffix}` },
    { value: `text2-${suffix}`, label: `text2-${suffix}` },
    { value: 'inbound-option', label: 'inbound-option' },
    { value: 'ot', label: 'OT', requiresTeamOff: true },
    { value: 'off', label: 'off' },
  ];
};

const MEMBER_ROLE_MAP = {
  text: { role: 'text', type: 'text' },
  inbound: { role: 'inbound', type: 'inbound' },
  outbound: { role: 'outbound', type: 'outbound' },
  'inbound-option': { role: 'inbound-option', type: 'inbound-option' },
  shift: { role: 'Shift', type: 'shift' },
  oncall: { role: 'Oncall', type: 'oncall' },
  off: { role: 'off', type: 'off' },
  ot: { role: 'OT', type: 'ot' },
};

const normalizeRoleValue = (role) => (role ?? '').toString().trim().toLowerCase();

const isTeamOff = (teamData) => {
  if (!teamData) return false;
  if (teamData.slotType === 'OFF') return true;
  const label = normalizeRoleValue(teamData.statusLabel);
  if (!label) return false;
  if (label === 'off') return true;
  return label.includes('تعطیل');
};

const getSlotLetter = (day, teamData) => {
  if (!day || !teamData) return null;
  if (day.isWeekend || day.isHoliday) return null;
  const slot = (teamData.slotType ?? '').toString().toUpperCase();
  return SLOT_TYPES.has(slot) ? slot : null;
};

const getMemberRoleOptions = (day, teamData, currentValue) => {
  const slot = getSlotLetter(day, teamData);
  const base = slot ? buildSlotOptions(slot) : MEMBER_ROLE_OPTIONS;
  if (!currentValue || base.some((opt) => opt.value === currentValue)) return base;
  return [{ value: currentValue, label: currentValue }, ...base];
};

const loadEditsForMonth = (year, month) => {
  try {
    const raw = localStorage.getItem(getEditsKey(year, month));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistEditsForMonth = (year, month, schedule) => {
  try {
    localStorage.setItem(getEditsKey(year, month), JSON.stringify(schedule));
  } catch {
    // ignore
  }
};

const clearEditsForMonth = (year, month) => {
  try {
    localStorage.removeItem(getEditsKey(year, month));
  } catch {
    // ignore
  }
};

const getMemberSelectValue = (member) => {
  if (!member) return 'off';

  const role = normalizeRoleValue(member.role);
  if (!role || role === '-' || role === 'off' || role.includes('تعطیل')) return 'off';
  if (role === 'ot') return 'ot';
  if (role.includes('inbound-option')) return 'inbound-option';

  const slotMatch = role.match(/^(text1|text2|inbound|outbound)-([a-f])$/);
  if (slotMatch) return `${slotMatch[1]}-${slotMatch[2]}`;

  if (member.type && MEMBER_ROLE_MAP[member.type]) return member.type;

  if (role.includes('inbound')) return 'inbound';
  if (role.includes('outbound')) return 'outbound';
  if (role.includes('text')) return 'text';
  if (role.includes('oncall')) return 'oncall';
  if (role.includes('shift')) return 'shift';

  return 'off';
};

const getMemberRoleMeta = (val) => {
  if (!val) return null;
  if (MEMBER_ROLE_MAP[val]) return MEMBER_ROLE_MAP[val];

  const normalized = val.toLowerCase();
  const match = normalized.match(/^(text1|text2|inbound|outbound)-([a-f])$/);
  if (!match) return null;

  const slot = match[2].toUpperCase();
  switch (match[1]) {
    case 'text1':
      return { role: `Text1-${slot}`, type: 'text' };
    case 'text2':
      return { role: `Text2-${slot}`, type: 'text' };
    case 'inbound':
      return { role: `Inbound-${slot}`, type: 'inbound' };
    case 'outbound':
      return { role: `Outbound-${slot}`, type: 'outbound' };
    default:
      return null;
  }
};

const ScheduleTable = () => {
  const { teams } = useTeams();
  const [year, setYear] = useState(1404);
  const [month, setMonth] = useState(12);

  const [originalSchedule, setOriginalSchedule] = useState([]);
  const [editSchedule, setEditSchedule] = useState([]);

  const [schedulerState, setSchedulerState] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const sortedTeams = useMemo(() => {
    if (!teams) return teams;

    const ORDER = ["thepurple", "portafavi"];
    const orderMap = new Map(ORDER.map((id, idx) => [id, idx]));

    return [...teams].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
      return ai - bi;
    });
  }, [teams]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) setSchedulerState(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (sortedTeams && sortedTeams.length >= 6) {
      const { schedule, nextState } = generateSchedule(sortedTeams, year, month, schedulerState);

      setOriginalSchedule(schedule);
      const savedEdits = loadEditsForMonth(year, month);
      const initialSchedule = savedEdits ? deepClone(savedEdits) : deepClone(schedule);
      setEditSchedule(initialSchedule);

      const snap = deepClone(initialSchedule);
      setHistory([snap]);
      setHistoryIndex(0);

      setSchedulerState(nextState);
      try { localStorage.setItem(STATE_KEY, JSON.stringify(nextState)); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedTeams, year, month]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const pushHistory = (newSchedule) => {
    setHistory(prev => {
      const base = prev.slice(0, historyIndex + 1);
      base.push(deepClone(newSchedule));
      return base;
    });
    setHistoryIndex(i => i + 1);
  };

  const handleUndo = () => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const snap = deepClone(history[newIndex]);
    setEditSchedule(snap);
    persistEditsForMonth(year, month, snap);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const snap = deepClone(history[newIndex]);
    setEditSchedule(snap);
    persistEditsForMonth(year, month, snap);
  };

  const handleReset = () => {
    if (!window.confirm("آیا از بازنشانی تغییرات اطمینان دارید؟")) return;
    const snap = deepClone(originalSchedule);
    setEditSchedule(snap);
    setHistory([deepClone(snap)]);
    setHistoryIndex(0);
    clearEditsForMonth(year, month);
  };

  const handleEdit = (dayIdx, teamId, mName, val) => {
    const updated = deepClone(editSchedule);
    const teamData = updated[dayIdx].teamsData.find(t => t.teamId === teamId);
    const member = teamData?.members.find(m => m.name === mName);
    if (!member) return;
    if (val === 'ot' && !isTeamOff(teamData)) return;

    const next = getMemberRoleMeta(val);
    if (!next) return;

    member.role = next.role;
    member.type = next.type;
    setEditSchedule(updated);
    pushHistory(updated);
    persistEditsForMonth(year, month, updated);
  };

  const handleLeaderEdit = (dayIdx, val) => {
    const updated = deepClone(editSchedule);
    updated[dayIdx].leader = val;
    setEditSchedule(updated);
    pushHistory(updated);
    persistEditsForMonth(year, month, updated);
  };

  // =======================
  // ✅ Leader select rules
  // =======================
  const leaderTeamMapUI = useMemo(() => {
    const map = {};
    (sortedTeams || []).forEach(t => {
      if (t?.leader && TEAM_LEAD_NAMES?.includes(t.leader)) {
        if (!map[t.leader]) map[t.leader] = [];
        map[t.leader].push(t.id);
      }
    });
    Object.keys(map).forEach((key) => {
      map[key] = Array.from(new Set(map[key]));
    });
    return map;
  }, [sortedTeams]);

  const getActiveShiftTeamIdForDay = (day) => {
    if (!day?.teamsData?.length) return null;

    // weekend => team with label Shift
    if (day.isWeekend) {
      const t = day.teamsData.find(x => x.statusLabel === 'Shift');
      return t?.teamId || null;
    }

    // working day => team with slot A
    const t = day.teamsData.find(x => x.slotType === 'A');
    return t?.teamId || null;
  };

  const isLeaderAllowedForDay = (leaderName, day) => {
    if (!leaderName || leaderName === '-') return true;

    // non-team-leads can be chosen anywhere
    if (!TEAM_LEAD_NAMES?.includes(leaderName)) return true;

    // team leads must match active shift team
    const activeTeamId = getActiveShiftTeamIdForDay(day);
    const mustTeamIds = leaderTeamMapUI[leaderName];

    if (!mustTeamIds || !activeTeamId) return false;
    return mustTeamIds.includes(activeTeamId);
  };

  const getOriginalTeamData = (dayIdx, teamId) => {
    const origDay = originalSchedule?.[dayIdx];
    return origDay?.teamsData?.find(t => t.teamId === teamId) || null;
  };

  const getDefaultTeamLabel = (dayIdx, day, teamId) => {
    const orig = getOriginalTeamData(dayIdx, teamId);
    if (!orig) return '-';

    if (day?.isWeekend || day?.isHoliday) return orig.statusLabel || '-';
    if (orig.slotType && orig.slotType !== 'OFF') return orig.slotType;
    return orig.statusLabel || '-';
  };

  const applyTeamAction = (dayIdx, targetTeamId, action) => {
    const updated = deepClone(editSchedule);
    const day = updated[dayIdx];
    const weekend = isWeekendDay(day);

    const restoreTeamFromOriginal = (teamId) => {
      const origDay = originalSchedule?.[dayIdx];
      if (!origDay) return;

      const origTeam = origDay.teamsData?.find(t => t.teamId === teamId);
      if (!origTeam) return;

      const idx = day.teamsData.findIndex(t => t.teamId === teamId);
      if (idx >= 0) {
        day.teamsData[idx] = deepClone(origTeam);
        delete day.teamsData[idx].uiOverride;
      }
    };

    const setTeamOff = (teamData) => {
      teamData.slotType = 'OFF';
      teamData.isOnCall = false;
      teamData.statusLabel = day.isHoliday ? 'تعطیل رسمی' : (day.isWeekend ? 'تعطیل' : 'OFF');
      teamData.members.forEach(m => { m.role = '-'; m.type = 'off'; });
      delete teamData.uiOverride;
    };

    const setTeamOncallWeekend = (teamData) => {
      teamData.slotType = 'C';
      teamData.isOnCall = true;
      teamData.statusLabel = 'Oncall';
      teamData.members.forEach(m => { m.role = 'Oncall'; m.type = 'oncall'; });
      delete teamData.uiOverride;
    };

    const setTeamShiftWeekend = (teamData) => {
      teamData.slotType = 'A';
      teamData.isOnCall = false;
      teamData.statusLabel = 'Shift';

      const teamMembers = teamData.members.map(x => x.name);
      if (teamMembers.length === 0) return;

      const startIdx = getNextTextShiftStartIndex(
        updated,
        dayIdx,
        teamData.teamId,
        teamMembers,
        schedulerState
      );

      const m1 = teamMembers[startIdx % teamMembers.length];
      const m2 = teamMembers[(startIdx + 1) % teamMembers.length];

      teamData.members.forEach(m => {
        if (m.name === m1 || m.name === m2) {
          m.role = 'Text-Shift';
          m.type = 'text';
        } else {
          m.role = 'Shift';
          m.type = 'shift';
        }
      });

      const nextIdx = (startIdx + 2) % teamMembers.length;
      const nextSchedulerState = schedulerState ? deepClone(schedulerState) : { textShiftIndices: {} };
      if (!nextSchedulerState.textShiftIndices) nextSchedulerState.textShiftIndices = {};
      nextSchedulerState.textShiftIndices[teamData.teamId] = nextIdx;

      setSchedulerState(nextSchedulerState);
      try { localStorage.setItem(STATE_KEY, JSON.stringify(nextSchedulerState)); } catch { }
      delete teamData.uiOverride;
    };

    const setTeamOncallWeekdayLite = (teamData) => {
      teamData.isOnCall = true;
      teamData.statusLabel = 'Oncall';
      teamData.slotType = 'C';
      delete teamData.uiOverride;
    };

    const setTeamShiftWeekdayLite = (teamData) => {
      teamData.isOnCall = false;
      teamData.statusLabel = 'Shift';
      teamData.slotType = 'A';
      delete teamData.uiOverride;
    };

    const currentShiftTeam = day.teamsData.find(t => t.statusLabel === 'Shift');
    const currentOncallTeam = day.teamsData.find(t => t.statusLabel === 'Oncall');

    const targetTeam = day.teamsData.find(t => t.teamId === targetTeamId);
    if (!targetTeam) return;

    if (action === 'default' || action === 'neutral') {
      restoreTeamFromOriginal(targetTeamId);
      setEditSchedule(updated);
      pushHistory(updated);
      persistEditsForMonth(year, month, updated);
      return;
    }

    if (action === 'shift') {
      if (currentShiftTeam && currentShiftTeam.teamId !== targetTeamId) {
        restoreTeamFromOriginal(currentShiftTeam.teamId);
      }
      if (currentOncallTeam && currentOncallTeam.teamId === targetTeamId) {
        restoreTeamFromOriginal(targetTeamId);
      }

      if (weekend) setTeamShiftWeekend(targetTeam);
      else setTeamShiftWeekdayLite(targetTeam);

      setEditSchedule(updated);
      pushHistory(updated);
      persistEditsForMonth(year, month, updated);
      return;
    }

    if (action === 'oncall') {
      if (currentOncallTeam && currentOncallTeam.teamId !== targetTeamId) {
        restoreTeamFromOriginal(currentOncallTeam.teamId);
      }
      if (currentShiftTeam && currentShiftTeam.teamId === targetTeamId) return;

      if (weekend) setTeamOncallWeekend(targetTeam);
      else setTeamOncallWeekdayLite(targetTeam);

      setEditSchedule(updated);
      pushHistory(updated);
      persistEditsForMonth(year, month, updated);
      return;
    }

    if (action === 'off') {
      setTeamOff(targetTeam);
      setEditSchedule(updated);
      pushHistory(updated);
      persistEditsForMonth(year, month, updated);
      return;
    }
  };

  const teamSelectValue = (day, dayIdx, teamId) => {
    const tData = day.teamsData.find(t => t.teamId === teamId);
    if (!tData) return 'default';

    if (tData.uiOverride === 'neutral') return 'default';

    const orig = getOriginalTeamData(dayIdx, teamId);
    const isDefault = !!(orig
      && tData.statusLabel === orig.statusLabel
      && tData.slotType === orig.slotType
      && tData.isOnCall === orig.isOnCall);

    if (isDefault) return 'default';

    if (tData.statusLabel === 'Shift') return 'shift';
    if (tData.statusLabel === 'Oncall') return 'oncall';

    if (tData.slotType === 'OFF' || tData.statusLabel === 'OFF' || tData.statusLabel?.includes('تعطیل')) return 'off';

    if (tData.isOnCall) return 'oncall';
    if (tData.slotType === 'A') return 'shift';

    return 'default';
  };

  // =====================================================================
  // ✅✅✅ STATS TABLE SECTION
  // =====================================================================
  const memberStatsMap = useMemo(() => {
    const map = {};
    if (!editSchedule?.length) return map;

    for (const day of editSchedule) {
      for (const t of (day.teamsData || [])) {
        for (const m of (t.members || [])) {
          if (!map[m.name]) map[m.name] = { text: 0, inbound: 0, outbound: 0 };

          if (m.type === 'text') map[m.name].text++;
          else if (m.type === 'inbound' || m.type === 'inbound-option') map[m.name].inbound++;
          else if (m.type === 'outbound') map[m.name].outbound++;
        }
      }
    }

    return map;
  }, [editSchedule]);

  const handleExportExcel = () => {
    if (!editSchedule?.length || !sortedTeams?.length) {
      window.alert('جدول برای دانلود آماده نیست.');
      return;
    }

    const dayHeaders = editSchedule.map((day) => `${day.date} ${day.dayName}`);
    const rows = [];

    rows.push(["تاریخ / کارشناس", "text", "inbound", "outbound", ...dayHeaders]);

    const leaderRow = ["سرشیفت", "", "", "", ...editSchedule.map((day) => day.leader || "-")];
    rows.push(leaderRow);

    sortedTeams.forEach((team) => {
      const teamRow = [
        team.name,
        "",
        "",
        "",
        ...editSchedule.map((day) => {
          const tData = day.teamsData.find((d) => d.teamId === team.id);
          if (!tData) return "-";
          if (tData.uiOverride === 'neutral') return "-";
          return tData.statusLabel || "-";
        })
      ];
      rows.push(teamRow);

      team.members.forEach((member) => {
        const stats = memberStatsMap[member] || { text: 0, inbound: 0, outbound: 0 };
        const memberRow = [
          member,
          stats.text ?? 0,
          stats.inbound ?? 0,
          stats.outbound ?? 0,
          ...editSchedule.map((day) => {
            const tData = day.teamsData.find((d) => d.teamId === team.id);
            const mData = tData?.members.find((m) => m.name === member);
            return mData?.role || "-";
          })
        ];
        rows.push(memberRow);
      });
    });

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const fileName = `shift-schedule-${year}-${String(month).padStart(2, '0')}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!sortedTeams || sortedTeams.length < 6) {
    return (
      <div className="p-10 text-center app-muted app-surface rounded-2xl m-4">
        لطفا حداقل 6 تیم تعریف کنید.
      </div>
    );
  }

  return (
    <div className="w-full font-sans z-10">
      {/* Outer premium frame */}
      <div className="relative app-surface overflow-hidden rounded-3xl app-soft-enter">
        {/* Soft glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[color:var(--primary-2)]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[color:var(--primary)]/10 blur-3xl" />

        {/* Top bar */}
        <div className="p-5 bg-[color:var(--surface-2)]/18 backdrop-blur-xl flex justify-between items-center border-b border-[color:var(--line)]/45 sticky top-0 z-10 transition-colors">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-[color:var(--surface-2)]/35 border border-[color:var(--line)]/45 grid place-items-center shadow-inner">
                <span className="text-[color:var(--primary)] font-black">S</span>
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-black text-[color:var(--text)] tracking-tight">
                  سامانه مدیریت شیفت
                </h2>
              </div>
           
            </div>

            <div className="h-8 w-px bg-[color:var(--line)]/45 mx-1 hidden md:block" />

            <div className="flex bg-[color:var(--surface)]/75 rounded-xl p-1.5 border border-[color:var(--line)]/45 shadow-inner gap-1">
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="app-select app-select--sm text-sm font-bold"
              >
                {JALAALI_MONTHS.map((m, i) => (
                  <option key={i} value={i + 1} className="bg-[color:var(--surface)] text-[color:var(--text)]">
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="app-select app-select--sm text-sm font-bold"
              >
                <option value={1404} className="bg-[color:var(--surface)] text-[color:var(--text)]">۱۴۰۴</option>
                <option value={1405} className="bg-[color:var(--surface)] text-[color:var(--text)]">۱۴۰۵</option>
              </select>
            </div>

            <button
              onClick={handleReset}
              className="px-4 py-2 bg-[color:var(--surface-2)]/35 text-[color:var(--text)] rounded-xl text-xs font-black transition-colors border border-[color:var(--line)]/45"
            >
              ریست تغییرات
            </button>

            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-colors border
                ${canUndo
                  ? 'bg-[color:var(--surface-2)]/35 text-[color:var(--text)] border-[color:var(--line)]/45'
                  : 'bg-[color:var(--surface-2)]/20 app-muted border-[color:var(--line)]/30 cursor-not-allowed'
                }`}
              title="بازگشت به تغییر قبلی"
            >
              ⟲ بازگشت
            </button>

            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-colors border
                ${canRedo
                  ? 'bg-[color:var(--surface-2)]/35 text-[color:var(--text)] border-[color:var(--line)]/45'
                  : 'bg-[color:var(--surface-2)]/20 app-muted border-[color:var(--line)]/30 cursor-not-allowed'
                }`}
              title="رفتن به تغییر بعدی"
            >
              ⟳ بعدی
            </button>
            
          </div>
           <button
              type="button"
              onClick={handleExportExcel}
              title="دانلود اکسل"
              aria-label="دانلود اکسل"
              className="w-10 h-10 rounded-2xl bg-green-600/40 border border-[color:var(--line)]/45 grid place-items-center shadow-inner text-green-800 transition-colors hover:bg-[color:var(--surface-2)]/55"
            >
              <ExcelIcon className="h-5 w-5" />
            </button>
        </div>

        {/* Table container */}
        <div className="scroll-pro overflow-auto max-h-[78vh]">
          <table className="schedule-table w-full border-collapse text-[11px] text-center table-fixed">
            <thead className="sticky top-0 z-30">
              <tr className="bg-[color:var(--surface-2)]/25 backdrop-blur-xl border-b border-[color:var(--line)]/45 shadow-sm">
                <th className="bg-[color:var(--surface)] p-4 border-r border-[color:var(--line)]/45 w-[170px] text-right text-[color:var(--text)]">
                  تاریخ / کارشناس
                </th>

                <th className="bg-[color:var(--surface)] p-2 border-r border-[color:var(--line)]/45 w-[80px] app-muted">
                  text
                </th>
                <th className="bg-[color:var(--surface)] p-2 border-r border-[color:var(--line)]/45 w-[85px] app-muted">
                  inbound
                </th>
                <th className="bg-[color:var(--surface)] p-2 border-r border-[color:var(--line)]/45 w-[90px] app-muted">
                  outbound
                </th>

                {editSchedule.map((day, i) => (
                  <th
                    key={i}
                    className={`p-2 border-r border-[color:var(--line)]/30 w-[104px] ${day.isWeekend || day.isHoliday ? 'bg-[color:var(--surface-2)]/16' : ''
                      }`}
                  >
                    <div className={`text-sm font-black ${day.isWeekend ? 'text-[color:var(--primary)]' : 'text-[color:var(--text)]'}`}>
                      {day.date.split('/')[2]}
                    </div>
                    <div className="text-[9px] opacity-50 uppercase">{day.dayName}</div>
                  </th>
                ))}
              </tr>

              <tr className="bg-[color:var(--surface-2)]/20 backdrop-blur-xl border-b border-[color:var(--line)]/40">
                <th className="bg-[color:var(--surface-2)]/22 p-2 border-r border-[color:var(--line)]/45 text-[color:var(--primary)] text-right px-4">
                  سرشیفت
                </th>

                {/* padding for stats */}
                <th className="bg-[color:var(--surface-2)]/22 p-2 border-r border-[color:var(--line)]/45 w-[80px] app-muted">—</th>
                <th className="bg-[color:var(--surface-2)]/22 p-2 border-r border-[color:var(--line)]/45 w-[85px] app-muted">—</th>
                <th className="bg-[color:var(--surface-2)]/22 p-2 border-r border-[color:var(--line)]/45 w-[90px] app-muted">—</th>

                {editSchedule.map((day, i) => (
                  <th key={i} className="p-1 border-r border-[color:var(--line)]/30">
                    <select
                      className="app-select app-select--table w-full text-center font-black"
                      value={day.leader || "-"}
                      onChange={(e) => handleLeaderEdit(i, e.target.value)}
                      title="انتخاب سرشیفت"
                    >
                      <option className="bg-[color:var(--surface)] text-[color:var(--text)]" value="-">-</option>
                      {(APPROVED_SHIFT_LEADERS || []).map((name) => {
                        const ok = isLeaderAllowedForDay(name, day);
                        return (
                          <option
                            key={name}
                            className="bg-[color:var(--surface)] text-[color:var(--text)]"
                            value={name}
                            disabled={!ok}
                          >
                            {name}{!ok ? " (فقط تیم خودش)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedTeams.map(team => (
                <React.Fragment key={team.id}>
                  {/* Team row */}
                  <tr className="bg-[color:var(--surface-2)]/14 font-black border-b border-[color:var(--line)]/30 team-row">
                    {/* âœ… ÙÙ‚Ø· Ø§ÙÙ‚ÛŒ sticky: right-0 (Ø¹Ù…ÙˆØ¯ÛŒ sticky Ù†ÛŒØ³Øª Ú†ÙˆÙ† top Ù†Ø¯Ø§Ø±ÛŒÙ…) */}
                    <td className="sticky right-0 z-20 bg-[color:var(--surface)] p-3 px-4 border-l border-[color:var(--line)]/35 text-right text-[color:var(--primary)] text-[11px] shadow-[-10px_0_20px_rgba(0,0,0,0.25)] team-name-cell">
                      {team.name}
                    </td>

                    {/* STATS: Ø­Ø±Ú©Øª Ú©Ù†Ù†Ø¯ (sticky Ù†Ø¯Ø§Ø±Ù†Ø¯) */}
                    <td className="p-2 border-r border-[color:var(--line)]/35 w-[80px]" />
                    <td className="p-2 border-r border-[color:var(--line)]/35 w-[85px]" />
                    <td className="p-2 border-r border-[color:var(--line)]/35 w-[90px]" />

                    {editSchedule.map((day, dayIdx) => {
                      const tData = day.teamsData.find(d => d.teamId === team.id);

                      const weekend = day.isWeekend || day.isHoliday;

                      const bg =
                        (weekend && tData?.statusLabel === 'Shift')
                          ? "cell-weekend-shift"
                          : (weekend && tData?.isOnCall)
                            ? "cell-weekend-oncall"
                            : (!weekend && tData?.slotType === 'A')
                              ? "cell-shift-a"
                              : (!weekend && tData?.isOnCall)
                                ? "cell-oncall-cd"
                                : "app-muted";
                      const val = teamSelectValue(day, dayIdx, team.id);
                      const defaultLabel = getDefaultTeamLabel(dayIdx, day, team.id);

                      return (
                        <td
                          key={dayIdx}
                          className={`p-1.5 border-r border-[color:var(--line)]/30 text-[12px] ${bg}`}
                        >
                          <select
                            value={val}
                            onChange={(e) => applyTeamAction(dayIdx, team.id, e.target.value)}
                            className="app-select app-select--table w-full text-center font-black"
                            title={tData?.statusLabel || '-'}
                          >
                            <option className="bg-[color:var(--surface)] text-[color:var(--text)]" value="default">
                              {defaultLabel}
                            </option>
                            <option className="bg-[color:var(--surface)] text-[color:var(--text)]" value="shift">Shift</option>
                            <option className="bg-[color:var(--surface)] text-[color:var(--text)]" value="oncall">Oncall</option>
                            <option className="bg-[color:var(--surface)] text-[color:var(--text)]" value="off">OFF</option>
                          </select>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Members */}
                  {team.members.map((member, rowIdx) => (
                    <tr
                      key={member}
                      className={`
                        border-b border-[color:var(--line)]/25 transition
                        ${rowIdx % 2 === 0 ? 'bg-[color:var(--surface)]/18' : 'bg-[color:var(--surface-2)]/10'}
                        hover:bg-[color:var(--surface-2)]/24
                      `}
                    >
                      {/* âœ… ÙÙ‚Ø· Ø§ÙÙ‚ÛŒ sticky: right-0 */}
                      <td className="sticky right-0 z-20 bg-[color:var(--surface)] p-2.5 px-4 border-l border-[color:var(--line)]/30 text-right text-[color:var(--text)] shadow-[-10px_0_20px_rgba(0,0,0,0.25)]">
                        {member}
                      </td>

                      {/* STATS: Ø­Ø±Ú©Øª Ú©Ù†Ù†Ø¯ (sticky Ù†Ø¯Ø§Ø±Ù†Ø¯) */}
                      {(() => {
                        const s = memberStatsMap[member] || { text: 0, inbound: 0, outbound: 0 };
                        return (
                          <>
                            <td className="p-2 border-r border-[color:var(--line)]/30 w-[80px] text-[color:var(--text)] font-black">
                              {s.text}
                            </td>
                            <td className="p-2 border-r border-[color:var(--line)]/30 w-[85px] text-[color:var(--text)] font-black">
                              {s.inbound}
                            </td>
                            <td className="p-2 border-r border-[color:var(--line)]/30 w-[90px] text-[color:var(--text)] font-black">
                              {s.outbound}
                            </td>
                          </>
                        );
                      })()}

                      {editSchedule.map((day, i) => {
                        const tData = day.teamsData.find(d => d.teamId === team.id);
                        const mData = tData?.members.find(m => m.name === member);
                        const selectValue = getMemberSelectValue(mData);
                        const options = getMemberRoleOptions(day, tData, selectValue);
                        const teamOff = isTeamOff(tData);
                        const isOt = selectValue === 'ot';

                        let cellStyle = "app-muted";

                        const weekend = day.isWeekend || day.isHoliday;

                        if (isOt) {
                          cellStyle = "cell-ot font-bold";

                        } else if (mData?.type === 'inbound-option') {
                          cellStyle = "cell-inbound-option font-bold shadow-inner";

                        } else if (weekend && tData?.statusLabel === 'Shift') {
                          cellStyle = "cell-weekend-shift";

                        } else if (weekend && tData?.isOnCall) {
                          cellStyle = "cell-weekend-oncall";

                        } else if (!weekend && tData?.slotType === 'A') {
                          cellStyle = "cell-shift-a";

                        } else if (!weekend && tData?.isOnCall && (tData?.slotType === 'C' || tData?.slotType === 'D')) {
                          cellStyle = "cell-oncall-cd";

                        } else if (weekend) {
                          cellStyle = "opacity-30";
                        }

                        return (
                          <td key={i} className={`p-0 border-r border-[color:var(--line)]/25 ${cellStyle}`}>
                            <select
                              className="app-select app-select--table w-full h-full text-center"
                              value={selectValue}
                              onChange={(e) => handleEdit(i, team.id, member, e.target.value)}
                              title={mData?.role || "-"}
                            >
                              {options.map((opt) => (
                                <option
                                  key={opt.value}
                                  value={opt.value}
                                  className="bg-[color:var(--surface)] text-[color:var(--text)]"
                                  disabled={opt.requiresTeamOff && !teamOff}
                                >
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="h-3" />
      </div>
    </div>
  );
};

export default ScheduleTable;
