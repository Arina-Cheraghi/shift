import React, { useEffect, useMemo, useState } from 'react';
import jalaali from 'jalaali-js';
import { useTeams } from '../hooks/useTeams';
import { APPROVED_SHIFT_LEADERS, generateSchedule } from '../utils/schedulerLogic';

const JALAALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const START_YEAR = 1404;
const START_MONTH = 1;
const END_YEAR_OPTIONS = [1404, 1405];
const ORDER = ['thepurple', 'portafavi'];

const RANGE_OPTIONS = [
  { value: '1', label: '1 ماه', months: 1 },
  { value: '3', label: '3 ماه', months: 3 },
  { value: '6', label: '6 ماه', months: 6 },
  { value: '12', label: '12 ماه', months: 12 },
  { value: 'all', label: 'از ابتدا تا انتها', months: null },
];

const monthToIndex = (year, month) => (year * 12) + (month - 1);
const indexToMonth = (idx) => ({ year: Math.floor(idx / 12), month: (idx % 12) + 1 });
const sumRows = (rows, field) => rows.reduce((acc, row) => acc + (row[field] || 0), 0);
const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(value)));

const getWeekKeyFromJalali = (dateStr) => {
  const [jyRaw, jmRaw, jdRaw] = String(dateStr || '').split('/');
  const jy = Number(jyRaw);
  const jm = Number(jmRaw);
  const jd = Number(jdRaw);
  if (!jy || !jm || !jd) return 'unknown';
  const gDate = jalaali.toGregorian(jy, jm, jd);
  const d = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
  const dow = d.getDay();
  const backToSat = (dow - 6 + 7) % 7;
  d.setDate(d.getDate() - backToSat);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
};

const buildRate = (ok, total) => ({
  ok,
  total,
  percent: total ? clampPercent((ok / total) * 100) : 100,
  noData: total === 0
});

const createEmptyRow = (name) => ({
  name,
  isMember: false,
  isTeamLead: false,
  isShiftLeader: false,
  inbound: 0,
  outbound: 0,
  text: 0,
  weekendShift: 0,
  weekendOncall: 0,
  shiftA: 0,
  oncallCD: 0,
  // For leaders: store shift counts, convert to hours at render time
  otWeekday: 0,
  otWeekend: 0,
});

const ScoreChip = ({ children }) => (
  <span className="inline-flex items-center justify-center rounded-lg border border-[color:var(--line)]/50 px-2 py-1 text-[11px] font-bold bg-[color:var(--surface-2)]/25 text-[color:var(--text)]">
    {children}
  </span>
);

const StatCard = ({ title, value }) => (
  <div className="rounded-2xl border border-[color:var(--line)]/55 bg-[color:var(--surface)]/70 p-4 shadow-sm">
    <p className="text-[11px] app-muted">{title}</p>
    <p className="text-2xl font-black mt-1 text-[color:var(--text)]">{value}</p>
  </div>
);

const DonutChart = ({ percent, noData, animate = false }) => {
  const safePercent = clampPercent(percent);
  const track = 'color-mix(in srgb, var(--line) 55%, transparent)';
  const fill = 'color-mix(in srgb, var(--primary) 85%, white 15%)';
  const size = 120;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayPercent = animate && !noData ? safePercent : 0;
  const progressOffset = circumference * (1 - (displayPercent / 100));

  return (
    <div className="relative w-24 h-24 md:w-28 md:h-28">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`donut-${safePercent}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={fill}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          className="donut-progress"
        />
      </svg>
      <div className="absolute inset-3 rounded-full bg-[color:var(--surface)] flex items-center justify-center border border-[color:var(--line)]/50 shadow-inner">
        <span className="text-lg font-black text-[color:var(--text)]">
          {noData ? '-' : `${displayPercent}%`}
        </span>
      </div>
    </div>
  );
};

const RuleCard = ({ title, description, rate, animate }) => (
  <div className="rounded-2xl border border-[color:var(--line)]/55 bg-[color:var(--surface)]/70 p-4 shadow-sm flex flex-col gap-4">
    <div>
      <h3 className="text-sm font-black text-[color:var(--text)]">{title}</h3>
      <p className="text-[11px] app-muted mt-1">{description}</p>
    </div>
    <div className="flex items-center gap-4">
      <DonutChart percent={rate.percent} noData={rate.noData} animate={animate} />
      <div className="text-[11px] app-muted space-y-1">
        <div className="font-bold text-[color:var(--text)]">{rate.noData ? 'بدون داده' : `رعایت: ${rate.ok}`}</div>
        <div>{rate.noData ? 'این شرط در بازه انتخابی رخ نداده است.' : `کل بررسی: ${rate.total}`}</div>
      </div>
    </div>
  </div>
);

const DataTable = ({ title, subtitle, rows, type = 'expert' }) => (
  <div className="rounded-2xl app-surface overflow-hidden shadow-sm">
    <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--line)]/45 bg-[color:var(--surface-2)]/18">
      <div>
        <h3 className="text-sm md:text-base text-[color:var(--text)] font-black">{title}</h3>
        <p className="text-[11px] app-muted">{subtitle}</p>
      </div>
      <ScoreChip>{rows.length} نفر</ScoreChip>
    </div>

    <div className="max-h-[58vh] overflow-auto scroll-pro">
      <table className="w-full min-w-[1180px] text-[12px] text-center">
        <thead className="bg-[color:var(--surface-2)]/22 sticky top-0 z-10">
          <tr className="border-b border-[color:var(--line)]/45">
            <th className="p-3 text-right text-[color:var(--text)]">نام</th>
            {type === 'expert' && <th className="p-3 text-[color:var(--text)]">Text</th>}
            {type === 'expert' && <th className="p-3 text-[color:var(--text)]">Inbound</th>}
            {type === 'expert' && <th className="p-3 text-[color:var(--text)]">Outbound</th>}
            {type === 'expert' && <th className="p-3 text-[color:var(--text)]">شیفت آخرهفته</th>}
            {type === 'expert' && <th className="p-3 text-[color:var(--text)]">آنکال آخرهفته</th>}
            {type === 'expert' && <th className="p-3 text-[color:var(--text)]">شیفت A</th>}
            {type === 'expert' && <th className="p-3 text-[color:var(--text)]">آنکال C/D</th>}
            {type === 'lead' && <th className="p-3 text-[color:var(--text)]">OT وسط هفته</th>}
            {type === 'lead' && <th className="p-3 text-[color:var(--text)]">OT آخرهفته</th>}
            <th className="p-3 text-[color:var(--text)]">ساعت اضافه‌کاری</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const leadWeekdayOt = row.otWeekday;
            const leadWeekendOt = row.otWeekend;
            const totalOtHours = type === 'expert'
              ? (row.shiftA * 2) + (row.oncallCD * 2) + (row.weekendShift * 7) + (row.weekendOncall * 7)
              : (leadWeekdayOt * 2) + (leadWeekendOt * 7);

            return (
              <tr
                key={`${title}-${row.name}`}
                className={`border-b border-[color:var(--line)]/30 ${idx % 2 === 0 ? 'bg-[color:var(--surface)]/25' : 'bg-[color:var(--surface-2)]/12'} hover:bg-[color:var(--surface-2)]/24 transition-colors`}
              >
                <td className="p-3 text-right text-[color:var(--text)] font-semibold">{row.name}</td>
                {type === 'expert' && <td className="p-3"><ScoreChip>{row.text}</ScoreChip></td>}
                {type === 'expert' && <td className="p-3"><ScoreChip>{row.inbound}</ScoreChip></td>}
                {type === 'expert' && <td className="p-3"><ScoreChip>{row.outbound}</ScoreChip></td>}
                {type === 'expert' && <td className="p-3"><ScoreChip>{row.weekendShift}</ScoreChip></td>}
                {type === 'expert' && <td className="p-3"><ScoreChip>{row.weekendOncall}</ScoreChip></td>}
                {type === 'expert' && <td className="p-3"><ScoreChip>{row.shiftA}</ScoreChip></td>}
                {type === 'expert' && <td className="p-3"><ScoreChip>{row.oncallCD}</ScoreChip></td>}
                {type === 'lead' && <td className="p-3"><ScoreChip>{leadWeekdayOt}</ScoreChip></td>}
                {type === 'lead' && <td className="p-3"><ScoreChip>{leadWeekendOt}</ScoreChip></td>}
                <td className="p-3"><ScoreChip>{totalOtHours}</ScoreChip></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const AnalyticsTable = () => {
  const { teams } = useTeams();
  const [endYear, setEndYear] = useState(1405);
  const [endMonth, setEndMonth] = useState(12);
  const [range, setRange] = useState('3');
  const [animateCharts, setAnimateCharts] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimateCharts(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const sortedTeams = useMemo(() => {
    const orderMap = new Map(ORDER.map((id, idx) => [id, idx]));
    return [...(teams || [])].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
      return ai - bi;
    });
  }, [teams]);

  const analytics = useMemo(() => {
    if (!sortedTeams || sortedTeams.length < 6) {
      return { rows: [], expertRows: [], leadRows: [], from: null, to: null, rules: [] };
    }

    const byName = new Map();
    const ensure = (name) => {
      if (!name) return null;
      if (!byName.has(name)) byName.set(name, createEmptyRow(name));
      return byName.get(name);
    };

    sortedTeams.forEach((team) => {
      (team.members || []).forEach((member) => {
        const row = ensure(member);
        if (row) row.isMember = true;
      });
      if (team.leader && team.leader !== 'تعیین نشده') {
        const row = ensure(team.leader);
        if (row) row.isTeamLead = true;
      }
    });

    (APPROVED_SHIFT_LEADERS || []).forEach((name) => {
      const row = ensure(name);
      if (row) row.isShiftLeader = true;
    });

    const toIdx = monthToIndex(endYear, endMonth);
    const rangeDef = RANGE_OPTIONS.find((x) => x.value === range);
    const fromIdx = rangeDef?.months
      ? Math.max(monthToIndex(START_YEAR, START_MONTH), toIdx - (rangeDef.months - 1))
      : monthToIndex(START_YEAR, START_MONTH);

    let schedulerState = null;
    const startIdx = monthToIndex(START_YEAR, START_MONTH);
    const rangeDays = [];

    for (let idx = startIdx; idx <= toIdx; idx += 1) {
      const { year, month } = indexToMonth(idx);
      const { schedule, nextState } = generateSchedule(sortedTeams, year, month, schedulerState);
      schedulerState = nextState;
      if (idx < fromIdx) continue;

      for (const day of schedule) {
        rangeDays.push(day);
        const leaderName = day.leader;

        if (leaderName && leaderName !== '-') {
          const leaderRow = ensure(leaderName);
          if (leaderRow) {
            leaderRow.isShiftLeader = true;
            if (day.isWeekend) leaderRow.otWeekend += 1;
            else if (!day.isHoliday) leaderRow.otWeekday += 1;
          }
        }



        for (const tData of (day.teamsData || [])) {
          for (const member of (tData.members || [])) {
            const row = ensure(member.name);
            if (!row) continue;
            row.isMember = true;

            if (member.type === 'text') row.text += 1;
            if (member.type === 'inbound' || member.type === 'inbound-option') row.inbound += 1;
            if (member.type === 'outbound') row.outbound += 1;

            if (day.isWeekend && (member.type === 'text' || member.type === 'shift')) row.weekendShift += 1;
            if (day.isWeekend && tData.isOnCall && member.type !== 'off') row.weekendOncall += 1;
            if (!day.isWeekend && !day.isHoliday && tData.slotType === 'A' && member.type !== 'off') row.shiftA += 1;
            if (!day.isWeekend && !day.isHoliday && tData.isOnCall && (tData.slotType === 'C' || tData.slotType === 'D') && member.type !== 'off') row.oncallCD += 1;
          }
        }
      }
    }

    const rows = Array.from(byName.values());
    const expertRows = [];
    const expertSeen = new Set();
    for (const team of sortedTeams) {
      for (const member of (team.members || [])) {
        const row = byName.get(member);
        if (row && row.isMember && !row.isShiftLeader && !row.isTeamLead && !expertSeen.has(row.name)) {
          expertRows.push(row);
          expertSeen.add(row.name);
        }
      }
    }

    const leadRows = [];
    const leadSeen = new Set();
    for (const leaderName of (APPROVED_SHIFT_LEADERS || [])) {
      const row = byName.get(leaderName);
      if (row && row.isShiftLeader && !leadSeen.has(row.name)) {
        leadRows.push(row);
        leadSeen.add(row.name);
      }
    }

    const teamNameById = new Map();
    sortedTeams.forEach((t) => teamNameById.set(t.id, t.name));

    const monthWeekendMap = new Map();
    const monthWeekendShiftMap = new Map();
    const monthWeekendOncallMap = new Map();
    const weekendShiftByWeek = new Map();
    const workingDays = [];

    const leaderTeamsMap = new Map();
    sortedTeams.forEach((team) => {
      if (team.leader && team.leader !== 'تعیین نشده') {
        const list = leaderTeamsMap.get(team.leader) || [];
        list.push(team.id);
        leaderTeamsMap.set(team.leader, list);
      }
    });
    const leaderStats = new Map();
    leaderTeamsMap.forEach((teamIds, leaderName) => {
      leaderStats.set(leaderName, { ok: 0, total: 0, teamIds });
    });

    const weekendShiftTeams = [];
    const memberLastTask = new Map();
    let taskOk = 0;
    let taskTotal = 0;

    rangeDays.forEach((day) => {
      const weekKey = getWeekKeyFromJalali(day.date);
      const [jy, jm] = String(day.date || '').split('/');
      const monthKey = `${jy || '0000'}-${jm || '00'}`;
      if (!monthWeekendMap.has(monthKey)) monthWeekendMap.set(monthKey, new Map());
      if (!monthWeekendShiftMap.has(monthKey)) monthWeekendShiftMap.set(monthKey, new Map());
      if (!monthWeekendOncallMap.has(monthKey)) monthWeekendOncallMap.set(monthKey, new Map());
      const monthMap = monthWeekendMap.get(monthKey);
      const monthShiftMap = monthWeekendShiftMap.get(monthKey);
      const monthOncallMap = monthWeekendOncallMap.get(monthKey);

      const tasksToday = new Map();
      const isWorkingDay = !day.isWeekend && !day.isHoliday;
      const weekdayOncallSet = new Set();

      if (isWorkingDay) {
        (day.teamsData || []).forEach((tData) => {
          if (tData.isOnCall) weekdayOncallSet.add(tData.teamId);
        });
        workingDays.push({ date: day.date, oncallSet: weekdayOncallSet });
      }

      (day.teamsData || []).forEach((tData) => {
        if (!monthMap.has(tData.teamId)) monthMap.set(tData.teamId, 0);
        if (day.isWeekend && (tData.statusLabel === 'Shift' || tData.isOnCall)) {
          monthMap.set(tData.teamId, (monthMap.get(tData.teamId) || 0) + 1);
        }

        if (!monthShiftMap.has(tData.teamId)) monthShiftMap.set(tData.teamId, 0);
        if (!monthOncallMap.has(tData.teamId)) monthOncallMap.set(tData.teamId, 0);
        if (day.isWeekend && tData.statusLabel === 'Shift') {
          monthShiftMap.set(tData.teamId, (monthShiftMap.get(tData.teamId) || 0) + 1);
        }
        if (day.isWeekend && tData.isOnCall) {
          monthOncallMap.set(tData.teamId, (monthOncallMap.get(tData.teamId) || 0) + 1);
        }

        (tData.members || []).forEach((member) => {
          tasksToday.set(member.name, member.type || 'off');
        });
      });

      if (day.isWeekend) {
        const shiftTeam = (day.teamsData || []).find((t) => t.statusLabel === 'Shift');
        if (shiftTeam?.teamId) weekendShiftTeams.push(shiftTeam.teamId);
        if (shiftTeam?.teamId) {
          if (!weekendShiftByWeek.has(weekKey)) weekendShiftByWeek.set(weekKey, new Set());
          weekendShiftByWeek.get(weekKey).add(shiftTeam.teamId);
        }
      }

      if (day.leader && leaderTeamsMap.has(day.leader)) {
        const activeTeamId = day.isWeekend
          ? (day.teamsData || []).find((t) => t.statusLabel === 'Shift')?.teamId
          : (!day.isHoliday ? (day.teamsData || []).find((t) => t.slotType === 'A')?.teamId : null);
        if (activeTeamId) {
          const stat = leaderStats.get(day.leader) || { ok: 0, total: 0, teamIds: leaderTeamsMap.get(day.leader) || [] };
          stat.total += 1;
          if ((stat.teamIds || []).includes(activeTeamId)) stat.ok += 1;
          leaderStats.set(day.leader, stat);
        }
      }

      tasksToday.forEach((type, name) => {
        if (!memberLastTask.has(name)) {
          memberLastTask.set(name, type);
          return;
        }
        const prev = memberLastTask.get(name);
        if (prev && type && prev !== 'off' && type !== 'off') {
          taskTotal += 1;
          if (prev !== type) taskOk += 1;
        }
        memberLastTask.set(name, type);
      });
    });

    let monthOk = 0;
    let monthTotal = 0;
    monthWeekendMap.forEach((teamMap) => {
      sortedTeams.forEach((team) => {
        const count = teamMap.get(team.id) || 0;
        monthTotal += 1;
        if (count <= 2) monthOk += 1;
      });
    });

    let weekdayOncallOk = 0;
    let weekdayOncallTotal = 0;
    for (let i = 1; i < workingDays.length; i += 1) {
      const prev = workingDays[i - 1];
      const curr = workingDays[i];
      sortedTeams.forEach((team) => {
        const prevOn = prev.oncallSet.has(team.id);
        const currOn = curr.oncallSet.has(team.id);
        weekdayOncallTotal += 1;
        if (!(prevOn && currOn)) weekdayOncallOk += 1;
      });
    }

    let wedOk = 0;
    let wedTotal = 0;
    let satOk = 0;
    let satTotal = 0;

    for (let i = 0; i < rangeDays.length; i += 1) {
      const day = rangeDays[i];
      const prev = rangeDays[i - 1];
      const next = rangeDays[i + 1];

      if (day?.dayName === 'چهارشنبه' && next?.dayName === 'پنج‌شنبه') {
        const wedTeamId = day.teamsData?.find((t) => t.slotType === 'A')?.teamId;
        if (wedTeamId) {
          wedTotal += 1;
          const thuShiftTeamId = next.teamsData?.find((t) => t.statusLabel === 'Shift')?.teamId;
          if (!thuShiftTeamId || thuShiftTeamId !== wedTeamId) wedOk += 1;
        }
      }

      if (day?.dayName === 'شنبه' && prev?.dayName === 'جمعه') {
        const satTeamId = day.teamsData?.find((t) => t.slotType === 'A')?.teamId;
        if (satTeamId) {
          satTotal += 1;
          const friShiftTeamId = prev.teamsData?.find((t) => t.statusLabel === 'Shift')?.teamId;
          if (!friShiftTeamId || friShiftTeamId !== satTeamId) satOk += 1;
        }
      }
    }

    let rotationOk = 0;
    const rotationTotal = Math.max(0, weekendShiftTeams.length - 1);
    for (let i = 1; i < weekendShiftTeams.length; i += 1) {
      if (weekendShiftTeams[i] !== weekendShiftTeams[i - 1]) rotationOk += 1;
    }

    const balanceRateForMonthMap = (mapByMonth) => {
      let ok = 0;
      let total = 0;
      mapByMonth.forEach((teamMap) => {
        let sum = 0;
        sortedTeams.forEach((team) => {
          sum += (teamMap.get(team.id) || 0);
        });
        const avg = sum / Math.max(1, sortedTeams.length);
        sortedTeams.forEach((team) => {
          const count = teamMap.get(team.id) || 0;
          total += 1;
          if (Math.abs(count - avg) <= 1) ok += 1;
        });
      });
      return { ok, total };
    };

    const weekendShiftBalance = balanceRateForMonthMap(monthWeekendShiftMap);
    const weekendOncallBalance = balanceRateForMonthMap(monthWeekendOncallMap);

    const orderedWeekKeys = Array.from(weekendShiftByWeek.keys()).sort();
    const weekIndexByKey = new Map(orderedWeekKeys.map((k, i) => [k, i]));
    const weekendShiftIndicesByTeam = new Map();
    sortedTeams.forEach((team) => weekendShiftIndicesByTeam.set(team.id, []));
    weekendShiftByWeek.forEach((teamSet, weekKey) => {
      const idx = weekIndexByKey.get(weekKey);
      if (typeof idx !== 'number') return;
      teamSet.forEach((teamId) => {
        if (!weekendShiftIndicesByTeam.has(teamId)) weekendShiftIndicesByTeam.set(teamId, []);
        weekendShiftIndicesByTeam.get(teamId).push(idx);
      });
    });

    let weekendGapOk = 0;
    let weekendGapTotal = 0;
    const minWeekendGap = 2;
    weekendShiftIndicesByTeam.forEach((indices) => {
      const sorted = [...indices].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) {
        weekendGapTotal += 1;
        const gap = sorted[i] - sorted[i - 1];
        if (gap >= minWeekendGap) weekendGapOk += 1;
      }
    });

    const leaderRules = Array.from(leaderStats.entries()).map(([name, stat]) => {
      const teamNames = Array.from(new Set(stat.teamIds || []))
        .map((id) => teamNameById.get(id))
        .filter(Boolean);
      const teamName = teamNames.length ? teamNames.join(' / ') : 'نامشخص';
      return {
        title: name,
        description: `درصد شیفت‌هایی که سرگروه با تیم خودش بوده (تیم: ${teamName})`,
        rate: buildRate(stat.ok, stat.total),
      };
    });

    const rules = [
      {
        title: 'سقف فعالیت آخرهفته در هر ماه',
        description: 'برای هر تیم در هر ماه، مجموع شیفت/آنکال آخرهفته بیشتر از ۲ نشود.',
        rate: buildRate(monthOk, monthTotal),
      },
      {
        title: 'عدم آنکال پشت‌سرهم در روزهای وسط هفته',
        description: 'برای هر تیم، دو روز کاری پشت‌سرهم آنکال نباشد.',
        rate: buildRate(weekdayOncallOk, weekdayOncallTotal),
      },
      {
        title: 'تعادل شیفت آخرهفته بین تیم‌ها',
        description: 'در هر ماه، تعداد شیفت آخرهفته هر تیم حداکثر ۱ اختلاف با میانگین داشته باشد.',
        rate: buildRate(weekendShiftBalance.ok, weekendShiftBalance.total),
      },
      {
        title: 'تعادل آنکال آخرهفته بین تیم‌ها',
        description: 'در هر ماه، تعداد آنکال آخرهفته هر تیم حداکثر ۱ اختلاف با میانگین داشته باشد.',
        rate: buildRate(weekendOncallBalance.ok, weekendOncallBalance.total),
      },
      {
        title: 'چهارشنبه A → پنج‌شنبه بدون شیفت همان تیم',
        description: 'اگر تیمی چهارشنبه شیفت A باشد، پنج‌شنبه نباید شیفت همان تیم باشد.',
        rate: buildRate(wedOk, wedTotal),
      },
      {
        title: 'شنبه A → جمعه قبل بدون شیفت همان تیم',
        description: 'اگر تیمی شنبه شیفت A باشد، جمعه قبلش نباید شیفت همان تیم باشد.',
        rate: buildRate(satOk, satTotal),
      },
      {
        title: 'چرخش تکست آخرهفته بین تیم‌ها',
        description: 'تیم شیفت آخرهفته در دو آخرهفته‌ی پشت‌سرهم تکراری نباشد.',
        rate: buildRate(rotationOk, rotationTotal),
      },
      {
        title: 'فاصله حداقل بین شیفت‌های آخرهفته هر تیم',
        description: 'برای هر تیم، بین دو شیفت آخرهفته حداقل یک آخرهفته فاصله باشد.',
        rate: buildRate(weekendGapOk, weekendGapTotal),
      },
      {
        title: 'عدم تکرار تسک در روزهای پشت‌سرهم',
        description: 'برای هر نفر، اگر دو روز پشت‌سرهم کار کند، نوع تسک تکراری نباشد.',
        rate: buildRate(taskOk, taskTotal),
      },
    ];

    return { rows, expertRows, leadRows, from: indexToMonth(fromIdx), to: indexToMonth(toIdx), rules, leaderRules };
  }, [sortedTeams, endYear, endMonth, range]);

  if (!sortedTeams || sortedTeams.length < 6) {
    return <div className="p-10 text-center app-muted rounded-2xl app-surface">لطفا حداقل 6 تیم تعریف کنید.</div>;
  }

  const totalInbound = sumRows(analytics.expertRows, 'inbound');
  const totalOutbound = sumRows(analytics.expertRows, 'outbound');
  const totalText = sumRows(analytics.expertRows, 'text');
  const totalExpertOt = analytics.expertRows.reduce((acc, r) => acc + (r.shiftA * 2) + (r.oncallCD * 2) + (r.weekendShift * 7) + (r.weekendOncall * 7), 0);
  const totalLeadOt = (sumRows(analytics.leadRows, 'otWeekday') * 2) + (sumRows(analytics.leadRows, 'otWeekend') * 7);

  return (
    <div className="w-full font-sans analytics-enter">
      <div className="relative rounded-3xl app-surface overflow-hidden">
        <div className="p-5 border-b border-[color:var(--line)]/45 bg-[color:var(--surface-2)]/16">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-black text-[color:var(--text)] tracking-tight">گزارش پیشرفته عملکرد</h2>
              <p className="text-[11px] app-muted">
                بازه: {analytics.from ? `${JALAALI_MONTHS[analytics.from.month - 1]} ${analytics.from.year}` : '-'} تا {analytics.to ? `${JALAALI_MONTHS[analytics.to.month - 1]} ${analytics.to.year}` : '-'}
              </p>
            </div>

            <div className="flex rounded-xl p-1.5 border border-[color:var(--line)]/45 bg-[color:var(--surface)]/75 shadow-inner gap-1">
              <select value={range} onChange={(e) => setRange(e.target.value)} className="bg-transparent text-sm px-2 py-1 outline-none font-bold text-[color:var(--text)]">
                {RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[color:var(--surface)] text-[color:var(--text)]">{opt.label}</option>
                ))}
              </select>
              <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} className="bg-transparent text-sm px-2 py-1 border-r border-[color:var(--line)]/45 outline-none font-bold text-[color:var(--text)]">
                {JALAALI_MONTHS.map((m, i) => (
                  <option key={m} value={i + 1} className="bg-[color:var(--surface)] text-[color:var(--text)]">{m}</option>
                ))}
              </select>
              <select value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} className="bg-transparent text-sm px-2 py-1 outline-none font-bold text-[color:var(--text)]">
                {END_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y} className="bg-[color:var(--surface)] text-[color:var(--text)]">{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            <StatCard title="کل Text کارشناسان" value={totalText} />
            <StatCard title="کل Inbound کارشناسان" value={totalInbound} />
            <StatCard title="کل Outbound کارشناسان" value={totalOutbound} />
            <StatCard title="کل OT کارشناسان (ساعت)" value={totalExpertOt} />
            <StatCard title="کل OT سرشیفت‌ها (ساعت)" value={totalLeadOt} />
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-5">
          <div className="rounded-2xl border border-[color:var(--line)]/55 bg-[color:var(--surface)]/70 p-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm md:text-base font-black text-[color:var(--text)]">نمودارهای بررسی شروط</h3>
                <p className="text-[11px] app-muted">محاسبه بر اساس بازه انتخابی همین صفحه</p>
              </div>
              <ScoreChip>{analytics.rules.length} شرط</ScoreChip>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              {analytics.rules.map((rule) => (
                <RuleCard key={rule.title} title={rule.title} description={rule.description} rate={rule.rate} animate={animateCharts} />
              ))}
            </div>
            {analytics.leaderRules?.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-black text-[color:var(--text)]">سرگروه و تیم خودش</h4>
                  <ScoreChip>{analytics.leaderRules.length} سرگروه</ScoreChip>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3">
                  {analytics.leaderRules.map((rule) => (
                    <RuleCard key={`leader-${rule.title}`} title={rule.title} description={rule.description} rate={rule.rate} animate={animateCharts} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DataTable title="جدول کارشناسان" subtitle="ستون OT وسط/آخر هفته حذف شد و OT کل به ساعت اضافه شد" rows={analytics.expertRows} type="expert" />
          <DataTable title="جدول سرشیفت‌ها" subtitle="جزئیات OT و ساعت کل اضافه‌کاری" rows={analytics.leadRows} type="lead" />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTable;
