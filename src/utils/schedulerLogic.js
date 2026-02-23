

import jalaali from 'jalaali-js';

export const APPROVED_SHIFT_LEADERS = [
  "یاسین کیایی", "مسلم آبسالان", "شیرین طهماسبی", "فاطمه ناموری",
  "الناز ابن تراب", "ملیکا سلگی", "رویا محمدی", "مرتضی داداشی",
  "شقایق جعفری", "مینا باقری", "ارسلان بگ محمدی", "مهدی فتحی زاده",
  "میثاق نوری", "عاطفه کریمی"
];

export const TEAM_LEAD_NAMES = [
  "مسلم آبسالان",
  "الناز ابن تراب",
  "فاطمه ناموری",
  "رویا محمدی",
  "مهدی فتحی زاده",
];

const MAX_LEADER_OT_HOURS = 15;
const MAX_LEADER_WEEKEND_SHIFTS = 1;
const LEADER_BALANCE_WINDOW_MONTHS = 2;
const MIN_MONTHLY_ONCALL_CD = 3;
const MAX_MONTHLY_ONCALL_CD = 4;

const SLOT_TASK_CONFIG = {
  'A': { inRatio: 0.85 }, 'B': { inRatio: 0.80 }, 'C': { inRatio: 0.70 },
  'D': { inRatio: 0.60 }, 'E': { inRatio: 0.50 }, 'F': { inRatio: 0.40 }
};

const PUBLIC_HOLIDAYS = ["11-22", "12-29", "12-30", "01-01", "01-02", "01-03", "01-04", "01-12", "01-13"];

const SPECIAL_INBOUND_GROUP = [
  "مهسا کریمی سروآغاجی", "غزل رفیع زاده", "آرزو شادمان", "هانیه بهار",
  "امیرحسین حسینی", "سید سعید موسوی", "روشنک مهری", "لیدا حیدری", "محمد امین حاجیلو"
];
const DEDICATED_INBOUND_OPTION_MEMBER = "سهیل حدادی";

const getDayName = (idx) => ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'][idx];

export const deepClone = (x) => JSON.parse(JSON.stringify(x));

const WEEKEND_SEQUENCE = [
  [0, 1, 2], [3, 4, 5],
  [1, 2, 0], [4, 5, 3],
  [2, 0, 1], [5, 3, 4]
];

// ✅ Week starts Saturday
const getWeekKey = (dateObj) => {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const dow = d.getDay();
  const backToSat = (dow - 6 + 7) % 7;
  d.setDate(d.getDate() - backToSat);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
};

const getMonthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const getPreviousMonthKey = (year, month) => {
  let y = year;
  let m = month - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return getMonthKey(y, m);
};

const getRecentMonthKeys = (year, month, count) => {
  const keys = [];
  let y = year;
  let m = month;

  for (let i = 0; i < count; i++) {
    keys.push(getMonthKey(y, m));
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }

  return keys;
};

const pruneWeeklyMap = (weeklyOncallMap, keep = 10) => {
  const keys = Object.keys(weeklyOncallMap).sort();
  if (keys.length <= keep) return;
  keys.slice(0, keys.length - keep).forEach(k => delete weeklyOncallMap[k]);
};

const buildDefaultState = () => ({
  weekRotationIndex: 0,
  textShiftIndices: {},

  memberTaskCounts: {},
  memberLastTask: {},

  lastLeaderName: null,
  workingDayCounterCarry: 0,

  leaderRotationIndex: 0,
  leaderNotPickedStreak: {},
  leaderMonthlyStatsByLeader: {},
  leaderTeamRotation: {},

  // ✅ NEW
  weeklyOncallMap: {},      // { [weekKey]: { [teamId]: true } }
  teamLastOncallStamp: {},  // { [teamId]: number }
  lastWeekdayOncallTeamId: null,
});

const buildLeaderTeamsMap = (teams) => {
  const map = {};
  for (const t of teams) {
    if (t?.leader && TEAM_LEAD_NAMES.includes(t.leader)) {
      if (!map[t.leader]) map[t.leader] = [];
      map[t.leader].push(t.id);
    }
  }
  return map;
};

const estimateMonthlyOtHours = (year, month) => {
  const daysInMonth = jalaali.jalaaliMonthLength(year, month);
  let total = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const gDate = jalaali.toGregorian(year, month, day);
    const dateObj = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
    const dow = dateObj.getDay();

    const isThu = dow === 4;
    const isFri = dow === 5;

    const isPublicHoliday = PUBLIC_HOLIDAYS.includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    const isWorkingDay = !isThu && !isFri && !isPublicHoliday;

    if (isWorkingDay) total += 2;
    else if (isThu || isFri) total += 7;
  }
  return total;
};

const estimateMonthlyLeaderDays = (year, month) => {
  const daysInMonth = jalaali.jalaaliMonthLength(year, month);
  let weekdayDays = 0;
  let weekendDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const gDate = jalaali.toGregorian(year, month, day);
    const dateObj = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
    const dow = dateObj.getDay();

    const isThu = dow === 4;
    const isFri = dow === 5;
    const isPublicHoliday = PUBLIC_HOLIDAYS.includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    const isWorkingDay = !isThu && !isFri && !isPublicHoliday;

    if (isWorkingDay) weekdayDays += 1;
    else if (isThu || isFri) weekendDays += 1;
  }

  return { weekdayDays, weekendDays, totalDays: weekdayDays + weekendDays };
};

export const getNextTextShiftStartIndex = (schedule, dayIdx, teamId, teamMembers, schedulerState) => {
  for (let d = dayIdx - 1; d >= 0; d--) {
    const day = schedule[d];
    const tData = day?.teamsData?.find(t => t.teamId === teamId);
    if (!tData) continue;
    if (tData.statusLabel !== 'Shift') continue;

    const textPeople = (tData.members || [])
      .filter(m => m?.role === 'Text-Shift' || m?.type === 'text')
      .map(m => m.name);

    if (textPeople.length === 0) continue;

    const firstIdx = teamMembers.indexOf(textPeople[0]);
    if (firstIdx >= 0) return (firstIdx + 2) % teamMembers.length;
  }

  const fromPrev = schedulerState?.textShiftIndices?.[teamId];
  if (typeof fromPrev === 'number' && teamMembers.length > 0) return fromPrev % teamMembers.length;

  return 0;
};

const assignRolesNoRepeat = (members, rolesNeeded, slotType, memberLastTask, memberTaskCounts) => {
  if (!members.length || !rolesNeeded.length) return {};

  const roleBuckets = rolesNeeded.map((role) => {
    const candidates = members
      .filter((member) => memberLastTask[member] !== role.t)
      .map((member) => ({
        member,
        cost: (memberTaskCounts[member]?.[role.t] || 0) * 10,
      }))
      .sort((a, b) => a.cost - b.cost);

    return { role, candidates };
  }).sort((a, b) => {
    if (a.candidates.length !== b.candidates.length) return a.candidates.length - b.candidates.length;
    const aCost = a.candidates[0]?.cost ?? 0;
    const bCost = b.candidates[0]?.cost ?? 0;
    return aCost - bCost;
  });

  if (roleBuckets.some((bucket) => bucket.candidates.length === 0)) return null;

  const assignments = {};
  const used = new Set();

  const dfs = (idx) => {
    if (idx >= roleBuckets.length) return true;
    const { role, candidates } = roleBuckets[idx];

    for (const candidate of candidates) {
      if (used.has(candidate.member)) continue;
      used.add(candidate.member);
      assignments[candidate.member] = { role: `${role.r}-${slotType}`, type: role.t };
      if (dfs(idx + 1)) return true;
      used.delete(candidate.member);
      delete assignments[candidate.member];
    }

    return false;
  };

  return dfs(0) ? assignments : null;
};

const assignRolesGreedy = (members, rolesNeeded, slotType, memberLastTask, memberTaskCounts) => {
  const potentialAssignments = [];

  members.forEach((member) => {
    rolesNeeded.forEach((role) => {
      const isRepetitive = memberLastTask[member] === role.t;
      const imbalanceScore = memberTaskCounts[member]?.[role.t] || 0;
      const cost = (isRepetitive ? 1000 : 0) + (imbalanceScore * 10);
      potentialAssignments.push({ member, role, cost });
    });
  });

  potentialAssignments.sort((a, b) => a.cost - b.cost);

  const assignedMembers = new Set();
  const assignedRoleIds = new Set();
  const assignments = {};

  potentialAssignments.forEach(({ member, role }) => {
    if (!assignedMembers.has(member) && !assignedRoleIds.has(role.id)) {
      assignments[member] = { role: `${role.r}-${slotType}`, type: role.t };
      assignedMembers.add(member);
      assignedRoleIds.add(role.id);
    }
  });

  return assignments;
};

const assignWorkingDayRoles = (members, rolesNeeded, slotType, memberLastTask, memberTaskCounts) => {
  const noRepeatAssignments = assignRolesNoRepeat(
    members,
    rolesNeeded,
    slotType,
    memberLastTask,
    memberTaskCounts
  );

  if (noRepeatAssignments) return noRepeatAssignments;

  return assignRolesGreedy(
    members,
    rolesNeeded,
    slotType,
    memberLastTask,
    memberTaskCounts
  );
};

const pickTextShiftMembers = (members, startIdx, memberLastTask) => {
  const total = members.length;
  if (total === 0) return { picked: [], nextIndex: startIdx };

  const pickCount = Math.min(2, total);
  const picked = [];

  let idx = startIdx % total;
  let scanned = 0;

  while (picked.length < pickCount && scanned < total) {
    const name = members[idx];
    if (memberLastTask[name] !== 'text' && !picked.includes(name)) {
      picked.push(name);
    }
    idx = (idx + 1) % total;
    scanned += 1;
  }

  scanned = 0;
  while (picked.length < pickCount && scanned < total) {
    const name = members[idx];
    if (!picked.includes(name)) {
      picked.push(name);
    }
    idx = (idx + 1) % total;
    scanned += 1;
  }

  return { picked, nextIndex: idx % total };
};

export const generateSchedule = (teams, year, month, prevState = null) => {
  const schedule = [];
  const daysInMonth = jalaali.jalaaliMonthLength(year, month);

  const state = prevState ? deepClone(prevState) : buildDefaultState();

  if (!state.textShiftIndices) state.textShiftIndices = {};
  if (!state.memberTaskCounts) state.memberTaskCounts = {};
  if (!state.memberLastTask) state.memberLastTask = {};
  if (typeof state.weekRotationIndex !== 'number') state.weekRotationIndex = 0;
  if (typeof state.workingDayCounterCarry !== 'number') state.workingDayCounterCarry = 0;

  if (typeof state.leaderRotationIndex !== 'number') state.leaderRotationIndex = 0;
  if (!state.leaderNotPickedStreak) state.leaderNotPickedStreak = {};
  if (!state.leaderMonthlyStatsByLeader) state.leaderMonthlyStatsByLeader = {};
  if (!state.leaderTeamRotation) state.leaderTeamRotation = {};

  // Migrate legacy monthly hours map if present
  if (state.leaderMonthlyHoursByLeader && Object.keys(state.leaderMonthlyStatsByLeader).length === 0) {
    APPROVED_SHIFT_LEADERS.forEach((name) => {
      const legacy = state.leaderMonthlyHoursByLeader[name] || {};
      const statsMap = {};
      Object.keys(legacy).forEach((k) => {
        statsMap[k] = { hours: legacy[k] || 0, weekdayCount: 0, weekendCount: 0 };
      });
      state.leaderMonthlyStatsByLeader[name] = statsMap;
    });
  }

  // ✅ NEW defaults
  if (!state.weeklyOncallMap) state.weeklyOncallMap = {};
  if (!state.teamLastOncallStamp) state.teamLastOncallStamp = {};
  if (!('lastWeekdayOncallTeamId' in state)) state.lastWeekdayOncallTeamId = null;

  teams.forEach(team => {
    team.members.forEach(m => {
      if (!state.memberTaskCounts[m]) {
        state.memberTaskCounts[m] = { text: 0, inbound: 0, outbound: 0, 'inbound-option': 0, shift: 0, oncall: 0 };
      } else {
        const base = { text: 0, inbound: 0, outbound: 0, 'inbound-option': 0, shift: 0, oncall: 0 };
        state.memberTaskCounts[m] = { ...base, ...state.memberTaskCounts[m] };
      }
      if (!(m in state.memberLastTask)) state.memberLastTask[m] = null;
    });
  });

  const monthlyWeekendActivityCount = {};
  teams.forEach(t => monthlyWeekendActivityCount[t.id] = 0);
  const monthlyOncallCount = {};
  teams.forEach(t => monthlyOncallCount[t.id] = 0);

  const leadersStats = {};
  APPROVED_SHIFT_LEADERS.forEach(n => leadersStats[n] = { hours: 0, weekendCount: 0, weekdayCount: 0 });

  const leaderTeamsMap = buildLeaderTeamsMap(teams);
  APPROVED_SHIFT_LEADERS.forEach(n => {
    if (!state.leaderMonthlyStatsByLeader[n]) state.leaderMonthlyStatsByLeader[n] = {};
  });

  const monthKey = getMonthKey(year, month);
  const prevMonthKey = getPreviousMonthKey(year, month);

  const totalMonthlyOt = estimateMonthlyOtHours(year, month);
  const { weekdayDays, weekendDays } = estimateMonthlyLeaderDays(year, month);
  const leaderCount = APPROVED_SHIFT_LEADERS.length;

  const prevStatsByLeader = {};
  const prevTotals = { hours: 0, weekdayCount: 0, weekendCount: 0 };
  APPROVED_SHIFT_LEADERS.forEach((name) => {
    const raw = state.leaderMonthlyStatsByLeader[name]?.[prevMonthKey] || {};
    const stats = {
      hours: raw.hours || 0,
      weekdayCount: raw.weekdayCount || 0,
      weekendCount: raw.weekendCount || 0,
    };
    prevStatsByLeader[name] = stats;
    prevTotals.hours += stats.hours;
    prevTotals.weekdayCount += stats.weekdayCount;
    prevTotals.weekendCount += stats.weekendCount;
  });

  const targetHoursAvg = (prevTotals.hours + totalMonthlyOt) / Math.max(1, leaderCount);
  const targetWeekdayAvg = (prevTotals.weekdayCount + weekdayDays) / Math.max(1, leaderCount);
  const targetWeekendAvg = (prevTotals.weekendCount + weekendDays) / Math.max(1, leaderCount);

  const desiredHoursThisMonth = {};
  const desiredWeekdayThisMonth = {};
  const desiredWeekendThisMonth = {};
  APPROVED_SHIFT_LEADERS.forEach((name) => {
    const prev = prevStatsByLeader[name] || { hours: 0, weekdayCount: 0, weekendCount: 0 };
    desiredHoursThisMonth[name] = targetHoursAvg - prev.hours;
    desiredWeekdayThisMonth[name] = targetWeekdayAvg - prev.weekdayCount;
    desiredWeekendThisMonth[name] = targetWeekendAvg - prev.weekendCount;
  });

  // Balance leaders with eligibility rules

  const memberTaskCounts = state.memberTaskCounts;
  const memberLastTask = state.memberLastTask;

  let workingDayCounter = state.workingDayCounterCarry;
  let lastLeaderName = state.lastLeaderName ?? null;
  let lastWeekdayOncallTeamId = state.lastWeekdayOncallTeamId ?? null;

  let fridayShiftTeamId = null;

  const buildWeekdayCdOpportunities = () => {
    const byDay = {};
    const totals = {};
    teams.forEach((t) => { totals[t.id] = 0; });
    const workingDays = [];

    const preWeekendActivityCount = {};
    teams.forEach((t) => { preWeekendActivityCount[t.id] = 0; });

    let preWeekRotationIndex = state.weekRotationIndex;
    let preWorkingDayCounter = state.workingDayCounterCarry;

    for (let d = 1; d <= daysInMonth; d++) {
      const gDate = jalaali.toGregorian(year, month, d);
      const dateObj = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
      const dow = dateObj.getDay();

      const dIsThu = dow === 4;
      const dIsFri = dow === 5;

      const dIsPublicHoliday = PUBLIC_HOLIDAYS.includes(`${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      const dIsWorkingDay = !dIsThu && !dIsFri && !dIsPublicHoliday;

      if (dIsThu) {
        const seq = WEEKEND_SEQUENCE[preWeekRotationIndex % 6];
        const teamThuShift = teams[seq[0]];
        const teamFriShift = teams[seq[1]];
        const teamOnCall = teams[seq[2]];

        if (teamThuShift && preWeekendActivityCount[teamThuShift.id] < 2) {
          preWeekendActivityCount[teamThuShift.id]++;
        }

        if (teamFriShift && preWeekendActivityCount[teamFriShift.id] < 2) {
          preWeekendActivityCount[teamFriShift.id]++;
        }

        if (teamOnCall && preWeekendActivityCount[teamOnCall.id] < 2) {
          preWeekendActivityCount[teamOnCall.id]++;
        }

        preWeekRotationIndex++;
      }

      if (!dIsWorkingDay) continue;

      workingDays.push(d);

      const slotA = preWorkingDayCounter % teams.length;
      const cId = teams[(slotA + 2) % teams.length]?.id || null;
      const dId = teams[(slotA + 3) % teams.length]?.id || null;

      byDay[d] = { cId, dId };
      if (cId) totals[cId] = (totals[cId] || 0) + 1;
      if (dId) totals[dId] = (totals[dId] || 0) + 1;

      preWorkingDayCounter++;
    }

    return { byDay, totals, workingDays };
  };

  const { byDay: weekdayCdByDay, totals: totalCdOpportunities, workingDays } = buildWeekdayCdOpportunities();
  const remainingCdOpportunities = { ...totalCdOpportunities };

  const totalWeekdayOncallSlots = workingDays.length;
  const teamCount = teams.length;
  const baseTarget = Math.min(
    MIN_MONTHLY_ONCALL_CD,
    Math.floor(totalWeekdayOncallSlots / Math.max(1, teamCount))
  );
  let extraSlots = totalWeekdayOncallSlots - (baseTarget * teamCount);
  if (extraSlots < 0) extraSlots = 0;

  const buildExtraOncallOrder = () => {
    const order = [];
    const seen = new Set();
    let counter = state.workingDayCounterCarry;

    for (let d = 1; d <= daysInMonth; d++) {
      const pair = weekdayCdByDay[d];
      if (!pair) continue;

      const onCallSlot = (Math.floor(counter / 6) % 2 === 0) ? 'C' : 'D';
      const preferredId = onCallSlot === 'C' ? pair.cId : pair.dId;

      if (preferredId && !seen.has(preferredId)) {
        order.push(preferredId);
        seen.add(preferredId);
      }

      counter++;
    }

    teams.forEach((t) => {
      if (!seen.has(t.id)) order.push(t.id);
    });

    return order;
  };

  const targetOncallCount = {};
  teams.forEach((t) => { targetOncallCount[t.id] = baseTarget; });

  if (extraSlots > 0 && baseTarget < MAX_MONTHLY_ONCALL_CD) {
    let remainingExtra = Math.min(
      extraSlots,
      teamCount * Math.max(0, MAX_MONTHLY_ONCALL_CD - baseTarget)
    );

    const extraOrder = buildExtraOncallOrder();
    for (const id of extraOrder) {
      if (remainingExtra <= 0) break;
      targetOncallCount[id] = Math.min(
        MAX_MONTHLY_ONCALL_CD,
        (targetOncallCount[id] || baseTarget) + 1
      );
      remainingExtra--;
    }
  }

  const nextWorkingDay = {};
  let next = null;
  for (let d = daysInMonth; d >= 1; d--) {
    nextWorkingDay[d] = next;
    if (weekdayCdByDay[d]) next = d;
  }

  const pickLeaderForDay = (activeShiftTeamId, currentOtHours, isWeekendDay) => {
    if (!activeShiftTeamId || currentOtHours <= 0) return "-";

    const streakMap = state.leaderNotPickedStreak || {};
    const rotStart = state.leaderRotationIndex % APPROVED_SHIFT_LEADERS.length;
    const desiredHoursOf = (name) => desiredHoursThisMonth[name] ?? 0;
    const desiredWeekdayOf = (name) => desiredWeekdayThisMonth[name] ?? 0;
    const desiredWeekendOf = (name) => desiredWeekendThisMonth[name] ?? 0;
    const remainingHoursNeed = (name) => desiredHoursOf(name) - (leadersStats[name]?.hours || 0);
    const remainingCategoryNeed = (name) => {
      if (isWeekendDay) return desiredWeekendOf(name) - (leadersStats[name]?.weekendCount || 0);
      return desiredWeekdayOf(name) - (leadersStats[name]?.weekdayCount || 0);
    };

    const isEligible = (name, ignoreLastLeader = false) => {
      if (!ignoreLastLeader && name === lastLeaderName) return false;
      if ((leadersStats[name].hours + currentOtHours) > MAX_LEADER_OT_HOURS) return false;
      if (isWeekendDay && (leadersStats[name].weekendCount || 0) >= MAX_LEADER_WEEKEND_SHIFTS) return false;

      if (TEAM_LEAD_NAMES.includes(name)) {
        const teamsForLeader = leaderTeamsMap[name];
        if (!teamsForLeader || teamsForLeader.length === 0) return false;

        if (teamsForLeader.length === 1) {
          if (teamsForLeader[0] !== activeShiftTeamId) return false;
        } else {
          const rotIdx = (state.leaderTeamRotation?.[name] ?? 0) % teamsForLeader.length;
          const requiredTeamId = teamsForLeader[rotIdx];
          if (requiredTeamId !== activeShiftTeamId) return false;
        }
      }
      return true;
    };

    let candidates = APPROVED_SHIFT_LEADERS.filter(n => isEligible(n, false));
    if (candidates.length === 0) {
      candidates = APPROVED_SHIFT_LEADERS.filter(n => isEligible(n, true));
    }
    if (candidates.length === 0) return "-";

    const rotIndexOf = (name) => APPROVED_SHIFT_LEADERS.indexOf(name);

    candidates.sort((a, b) => {
      const catNeedA = remainingCategoryNeed(a);
      const catNeedB = remainingCategoryNeed(b);
      if (catNeedA !== catNeedB) return catNeedB - catNeedA;

      const hoursNeedA = remainingHoursNeed(a);
      const hoursNeedB = remainingHoursNeed(b);
      if (hoursNeedA !== hoursNeedB) return hoursNeedB - hoursNeedA;

      const ha = leadersStats[a].hours;
      const hb = leadersStats[b].hours;
      if (ha !== hb) return ha - hb;

      const sa = streakMap[a] || 0;
      const sb = streakMap[b] || 0;
      if (sa !== sb) return sb - sa;

      if (ha !== hb) return ha - hb;

      const ia = rotIndexOf(a);
      const ib = rotIndexOf(b);
      const da = (ia - rotStart + APPROVED_SHIFT_LEADERS.length) % APPROVED_SHIFT_LEADERS.length;
      const db = (ib - rotStart + APPROVED_SHIFT_LEADERS.length) % APPROVED_SHIFT_LEADERS.length;
      return da - db;
    });

    const chosen = candidates[0];
    const chosenIdx = APPROVED_SHIFT_LEADERS.indexOf(chosen);
    state.leaderRotationIndex = (chosenIdx + 1) % APPROVED_SHIFT_LEADERS.length;
    if (TEAM_LEAD_NAMES.includes(chosen)) {
      const teamsForLeader = leaderTeamsMap[chosen];
      if (teamsForLeader && teamsForLeader.length > 1) {
        const currentIdx = (state.leaderTeamRotation?.[chosen] ?? 0) % teamsForLeader.length;
        state.leaderTeamRotation[chosen] = (currentIdx + 1) % teamsForLeader.length;
      }
    }

    return chosen;
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const gDate = jalaali.toGregorian(year, month, day);
    const dateObj = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
    const dayOfWeek = dateObj.getDay();

    const isThu = dayOfWeek === 4;
    const isFri = dayOfWeek === 5;
    const isSat = dayOfWeek === 6;

    const isPublicHoliday = PUBLIC_HOLIDAYS.includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    const isWorkingDay = !isThu && !isFri && !isPublicHoliday;

    let weekendShiftId = null;
    let weekendOnCallId = null;

    if (isThu) {
      const seq = WEEKEND_SEQUENCE[state.weekRotationIndex % 6];
      const teamThuShift = teams[seq[0]];
      const teamFriShift = teams[seq[1]];
      const teamOnCall = teams[seq[2]];

      if (teamThuShift && monthlyWeekendActivityCount[teamThuShift.id] < 2) {
        weekendShiftId = teamThuShift.id;
        monthlyWeekendActivityCount[teamThuShift.id]++;
      }

      if (teamFriShift && monthlyWeekendActivityCount[teamFriShift.id] < 2) {
        fridayShiftTeamId = teamFriShift.id;
        monthlyWeekendActivityCount[teamFriShift.id]++;
      } else {
        fridayShiftTeamId = null;
      }

      if (teamOnCall && monthlyWeekendActivityCount[teamOnCall.id] < 2) {
        weekendOnCallId = teamOnCall.id;
        monthlyWeekendActivityCount[teamOnCall.id]++;
      }

      // Swap Thu/Fri shifts if Wed A or Sat A would create back-to-back shifts.
      if (weekendShiftId && fridayShiftTeamId) {
        let shouldSwap = false;

        // Wed -> Thu conflict
        const prevDate = new Date(dateObj);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDow = prevDate.getDay();
        if (prevDow === 3 && workingDayCounter > 0) {
          const prevJ = jalaali.toJalaali(prevDate);
          const prevIsHoliday = PUBLIC_HOLIDAYS.includes(`${String(prevJ.jm).padStart(2, '0')}-${String(prevJ.jd).padStart(2, '0')}`);
          if (!prevIsHoliday) {
            const prevSlotAIndex = (workingDayCounter - 1 + teams.length) % teams.length;
            const wedSlotAId = teams[prevSlotAIndex]?.id || null;
            if (wedSlotAId && weekendShiftId === wedSlotAId) shouldSwap = true;
          }
        }

        // Fri -> Sat conflict
        const satDate = new Date(dateObj);
        satDate.setDate(satDate.getDate() + 2);
        const satDow = satDate.getDay();
        if (satDow === 6) {
          const satJ = jalaali.toJalaali(satDate);
          const satIsHoliday = PUBLIC_HOLIDAYS.includes(`${String(satJ.jm).padStart(2, '0')}-${String(satJ.jd).padStart(2, '0')}`);
          if (!satIsHoliday) {
            const satSlotAId = teams[workingDayCounter % teams.length]?.id || null;
            if (satSlotAId && fridayShiftTeamId === satSlotAId) shouldSwap = true;
          }
        }

        if (shouldSwap) {
          const tmp = weekendShiftId;
          weekendShiftId = fridayShiftTeamId;
          fridayShiftTeamId = tmp;
        }
      }

      state.weekRotationIndex++;
    } else if (isFri) {
      weekendShiftId = fridayShiftTeamId;
    }

    // ? weekday slots
    let slotAIndex = -1;
    if (isWorkingDay) {
      slotAIndex = workingDayCounter % teams.length;
    }

    const onCallSlot = (Math.floor(workingDayCounter / 6) % 2 === 0) ? 'C' : 'D';

    // ? weekly tracking
    const weekKey = getWeekKey(dateObj);
    if (!state.weeklyOncallMap[weekKey]) state.weeklyOncallMap[weekKey] = {};
    const weekOncallSet = state.weeklyOncallMap[weekKey];

    // ✅ compute slotType ALWAYS by diff (no swap)
    const slotByTeamId = {};
    if (isWorkingDay && slotAIndex >= 0) {
      teams.forEach((team, teamIndex) => {
        const diff = (teamIndex - slotAIndex + teams.length) % teams.length;
        slotByTeamId[team.id] = ['A', 'B', 'C', 'D', 'E', 'F'][diff];
      });
    }

    // ✅ choose who is oncall today WITHOUT changing slot order
    let effectiveOncallTeamId = null;
    if (isWorkingDay && slotAIndex >= 0) {
      const teamIdForSlot = (slot) => teams.find(t => slotByTeamId[t.id] === slot)?.id || null;
      const fallbackCId = teamIdForSlot('C');
      const fallbackDId = teamIdForSlot('D');
      const precomputedPair = weekdayCdByDay[day] || {};
      const cId = precomputedPair.cId || fallbackCId;
      const dId = precomputedPair.dId || fallbackDId;

      if (cId || dId) {
        const candidates = [];
        if (cId) candidates.push({ id: cId, slot: 'C' });
        if (dId && dId !== cId) candidates.push({ id: dId, slot: 'D' });

        const preferredByRotation = onCallSlot === 'C' ? cId : dId;
        const countOf = (id) => monthlyOncallCount[id] ?? 0;
        const targetOf = (id) => targetOncallCount[id] ?? baseTarget;
        const remainingNeed = (id) => Math.max(0, targetOf(id) - countOf(id));
        const atOrAboveTarget = (id) => remainingNeed(id) <= 0;
        const blockedByConsecutive = (id) => !!(lastWeekdayOncallTeamId && id === lastWeekdayOncallTeamId);
        const blockedBySaturdayRule = (id) => !!(isSat && id && id === fridayShiftTeamId);
        const remainingAfterToday = (id) => {
          const rem = remainingCdOpportunities[id] ?? 0;
          const appearsToday = (id === cId || id === dId) ? 1 : 0;
          return Math.max(0, rem - appearsToday);
        };
        const mustPickToday = (id) => remainingNeed(id) > remainingAfterToday(id);
        const slackOf = (id) => (remainingCdOpportunities[id] ?? 0) - remainingNeed(id);

        const wouldBlockTomorrow = (id) => {
          const nextDay = nextWorkingDay[day];
          if (!nextDay) return false;
          const nextPair = weekdayCdByDay[nextDay];
          if (!nextPair) return false;

          const nextCandidates = [];
          if (nextPair.cId) nextCandidates.push(nextPair.cId);
          if (nextPair.dId && nextPair.dId !== nextPair.cId) nextCandidates.push(nextPair.dId);

          const remainingNeedAfterPick = (teamId) => {
            const baseNeed = remainingNeed(teamId);
            return teamId === id ? Math.max(0, baseNeed - 1) : baseNeed;
          };

          const availableTomorrow = nextCandidates.filter((teamId) => remainingNeedAfterPick(teamId) > 0);
          return availableTomorrow.length === 1 && availableTomorrow[0] === id;
        };

        const pickBest = (pool) => {
          if (!pool.length) return null;

          const ordered = [...pool].sort((a, b) => {
            const mustA = mustPickToday(a.id) ? 1 : 0;
            const mustB = mustPickToday(b.id) ? 1 : 0;
            if (mustA !== mustB) return mustB - mustA;

            const blockA = wouldBlockTomorrow(a.id) ? 1 : 0;
            const blockB = wouldBlockTomorrow(b.id) ? 1 : 0;
            if (blockA !== blockB) return blockA - blockB;

            const slackA = slackOf(a.id);
            const slackB = slackOf(b.id);
            if (slackA !== slackB) return slackA - slackB;

            const needA = remainingNeed(a.id);
            const needB = remainingNeed(b.id);
            if (needA !== needB) return needB - needA;

            const rotA = a.id === preferredByRotation ? 0 : 1;
            const rotB = b.id === preferredByRotation ? 0 : 1;
            if (rotA !== rotB) return rotA - rotB;

            const countA = countOf(a.id);
            const countB = countOf(b.id);
            if (countA !== countB) return countA - countB;

            const weekA = weekOncallSet[a.id] ? 1 : 0;
            const weekB = weekOncallSet[b.id] ? 1 : 0;
            if (weekA !== weekB) return weekA - weekB;

            const stampA = state.teamLastOncallStamp[a.id] ?? 0;
            const stampB = state.teamLastOncallStamp[b.id] ?? 0;
            if (stampA !== stampB) return stampA - stampB;

            return 0;
          });

          return ordered[0]?.id || null;
        };

        const eligiblePool = candidates.filter((c) => !atOrAboveTarget(c.id));
        const strictPool = eligiblePool.filter(
          (c) => !blockedBySaturdayRule(c.id) && !blockedByConsecutive(c.id)
        );
        let picked = pickBest(strictPool);

        if (!picked) {
          const noSatPool = eligiblePool.filter((c) => !blockedByConsecutive(c.id));
          picked = pickBest(noSatPool);
        }

        effectiveOncallTeamId = picked || null;

        if (cId) remainingCdOpportunities[cId] = Math.max(0, (remainingCdOpportunities[cId] ?? 0) - 1);
        if (dId && dId !== cId) remainingCdOpportunities[dId] = Math.max(0, (remainingCdOpportunities[dId] ?? 0) - 1);
      }
    }

    // Pre-Assignments
    const dailyPreAssignments = {};
    const soheilTeam = teams.find(t => t.members.includes(DEDICATED_INBOUND_OPTION_MEMBER));
    if (soheilTeam && isWorkingDay) {
      dailyPreAssignments[DEDICATED_INBOUND_OPTION_MEMBER] = { role: 'inbound-option', type: 'inbound-option', teamId: soheilTeam.id };
    }

    if (isWorkingDay) {
      const candidates = [];
      teams.forEach(team => {
        const teamIndex = teams.indexOf(team);
        const diff = (teamIndex - slotAIndex + teams.length) % teams.length;
        if (diff < 6) {
          team.members.forEach(member => {
            if (
              SPECIAL_INBOUND_GROUP.includes(member) &&
              !dailyPreAssignments[member] &&
              memberLastTask[member] !== 'inbound-option'
            ) {
              candidates.push({ name: member, teamId: team.id, count: memberTaskCounts[member]['inbound-option'] });
            }
          });
        }
      });

      candidates.sort((a, b) => a.count - b.count);

      const selectedPair = [];
      if (candidates.length > 0) {
        selectedPair.push(candidates[0]);
        const secondCandidate = candidates.find(c => c.name !== candidates[0].name && c.teamId !== candidates[0].teamId);
        if (secondCandidate) selectedPair.push(secondCandidate);
      }

      if (selectedPair.length === 2) {
        selectedPair.forEach(person => {
          dailyPreAssignments[person.name] = { role: 'inbound-option', type: 'inbound-option', teamId: person.teamId };
        });
      }
    }

    const currentOtHours = isWorkingDay ? 2 : ((isThu || isFri) ? 7 : 0);
    const activeShiftTeamId =
      (isThu || isFri) ? weekendShiftId
        : (isWorkingDay && slotAIndex >= 0 ? teams[slotAIndex].id : null);

    const isWeekendLeaderDay = isThu || isFri;
    let selectedLeader = pickLeaderForDay(activeShiftTeamId, currentOtHours, isWeekendLeaderDay);

    if (selectedLeader !== "-") {
      leadersStats[selectedLeader].hours += currentOtHours;
      if (isWeekendLeaderDay) leadersStats[selectedLeader].weekendCount += 1;
      else leadersStats[selectedLeader].weekdayCount += 1;
      lastLeaderName = selectedLeader;
    }

    const dailyAllocation = teams.map((team, teamIndex) => {
      let slotType = 'OFF';
      let statusLabel = isPublicHoliday ? 'تعطیل رسمی' : 'تعطیل';
      let isOnCall = false;

      const dayAssignments = {};
      Object.keys(dailyPreAssignments).forEach(memberName => {
        if (dailyPreAssignments[memberName].teamId === team.id) {
          dayAssignments[memberName] = { role: dailyPreAssignments[memberName].role, type: dailyPreAssignments[memberName].type };
        }
      });

      if (isWorkingDay && slotAIndex >= 0) {
        // ✅ slot order ALWAYS stable
        slotType = slotByTeamId[team.id] || 'OFF';
        statusLabel = (slotType === 'A') ? 'شیفت A' : ` ${slotType}`;

        // ✅ oncall determined by effectiveOncallTeamId, not slotType
        if (effectiveOncallTeamId && team.id === effectiveOncallTeamId) {
          isOnCall = true;
        }
      } else if ((isThu || isFri) && team.id === weekendShiftId) {
        statusLabel = 'Shift';
        slotType = 'A';
      } else if (isThu && team.id === weekendOnCallId) {
        statusLabel = 'Oncall';
        isOnCall = true;
        slotType = 'C';
      }

      if (slotType !== 'OFF') {
        if ((isThu || isFri) && team.id === weekendShiftId) {
          const availableMembers = team.members.filter(m => !dayAssignments[m]);
          if (availableMembers.length > 0) {
            let idx0 = state.textShiftIndices[team.id] ?? 0;
            const { picked, nextIndex } = pickTextShiftMembers(availableMembers, idx0, memberLastTask);

            const m1 = picked[0];
            const m2 = picked[1];

            if (m1) dayAssignments[m1] = { role: 'Text-Shift', type: 'text' };
            if (m2) dayAssignments[m2] = { role: 'Text-Shift', type: 'text' };

            availableMembers.forEach(m => {
              if (!dayAssignments[m]) dayAssignments[m] = { role: 'Shift', type: 'shift' };
            });

            state.textShiftIndices[team.id] = nextIndex;
          }
        } else if (isThu && team.id === weekendOnCallId) {
          team.members.forEach(m => dayAssignments[m] = { role: 'Oncall', type: 'oncall' });
        } else {
          const remainingMembers = team.members.filter(m => !dayAssignments[m]);
          if (remainingMembers.length > 0) {
            const rolesNeeded = [];
            const textCount = 2;
            const rem = remainingMembers.length - textCount;
            const inCount = Math.round(rem * (SLOT_TASK_CONFIG[slotType]?.inRatio || 0.5));

            for (let k = 0; k < Math.min(textCount, remainingMembers.length); k++) rolesNeeded.push({ id: `text_${k}`, r: `Text${k + 1}`, t: 'text' });
            for (let k = 0; k < Math.min(inCount, remainingMembers.length - rolesNeeded.length); k++) rolesNeeded.push({ id: `inbound_${k}`, r: 'Inbound', t: 'inbound' });
            while (rolesNeeded.length < remainingMembers.length) rolesNeeded.push({ id: `outbound_${rolesNeeded.length}`, r: 'Outbound', t: 'outbound' });

            const assignments = assignWorkingDayRoles(
              remainingMembers,
              rolesNeeded,
              slotType,
              memberLastTask,
              memberTaskCounts
            );

            remainingMembers.forEach((member) => {
              if (assignments[member]) {
                dayAssignments[member] = assignments[member];
              }
            });
          }
        }
      } else {
        team.members.forEach(member => {
          if (!dayAssignments[member]) dayAssignments[member] = { role: '-', type: 'off' };
        });
      }

      return {
        teamId: team.id,
        teamName: team.name,
        statusLabel,
        slotType,
        isOnCall,
        members: team.members.map(m => ({ name: m, ...dayAssignments[m] }))
      };
    });

    // Persist task history (cross-month)
    dailyAllocation.forEach(teamData => {
      teamData.members.forEach(member => {
        if (member.type && member.type !== 'off') {
          memberLastTask[member.name] = member.type;
          if (!memberTaskCounts[member.name][member.type]) memberTaskCounts[member.name][member.type] = 0;
          memberTaskCounts[member.name][member.type]++;
        } else if (member.type === 'off') {
          memberLastTask[member.name] = 'off';
        }
      });
    });

    // ✅ mark oncall picked (weekday)
    if (isWorkingDay && effectiveOncallTeamId) {
      weekOncallSet[effectiveOncallTeamId] = true;
      const stamp = (gDate.gy * 10000) + (gDate.gm * 100) + gDate.gd;
      state.teamLastOncallStamp[effectiveOncallTeamId] = stamp;
      monthlyOncallCount[effectiveOncallTeamId] = (monthlyOncallCount[effectiveOncallTeamId] || 0) + 1;
      lastWeekdayOncallTeamId = effectiveOncallTeamId;
    } else if (isWorkingDay) {
      lastWeekdayOncallTeamId = null;
    }

    // ✅ mark weekend oncall too (if you want it counted in the same week rule)
    if (isThu && weekendOnCallId) {
      weekOncallSet[weekendOnCallId] = true;
      const stamp = (gDate.gy * 10000) + (gDate.gm * 100) + gDate.gd;
      state.teamLastOncallStamp[weekendOnCallId] = stamp;
    }

    if (!isWorkingDay) {
      lastWeekdayOncallTeamId = null;
    }

    schedule.push({
      date: `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
      dayName: getDayName(dayOfWeek),
      leader: selectedLeader,
      isWeekend: isThu || isFri,
      isHoliday: isPublicHoliday,
      teamsData: dailyAllocation
    });

    if (isWorkingDay) workingDayCounter++;
    pruneWeeklyMap(state.weeklyOncallMap, 10);
  }

  APPROVED_SHIFT_LEADERS.forEach(name => {
    const picked = (leadersStats[name]?.hours || 0) > 0;
    if (picked) state.leaderNotPickedStreak[name] = 0;
    else state.leaderNotPickedStreak[name] = (state.leaderNotPickedStreak[name] || 0) + 1;
  });

  const keepMonthKeys = new Set(getRecentMonthKeys(year, month, LEADER_BALANCE_WINDOW_MONTHS));
  APPROVED_SHIFT_LEADERS.forEach(name => {
    if (!state.leaderMonthlyStatsByLeader[name]) state.leaderMonthlyStatsByLeader[name] = {};
    state.leaderMonthlyStatsByLeader[name][monthKey] = {
      hours: leadersStats[name]?.hours || 0,
      weekdayCount: leadersStats[name]?.weekdayCount || 0,
      weekendCount: leadersStats[name]?.weekendCount || 0,
    };

    const history = state.leaderMonthlyStatsByLeader[name];
    Object.keys(history).forEach((k) => {
      if (!keepMonthKeys.has(k)) delete history[k];
    });
  });

  state.memberTaskCounts = memberTaskCounts;
  state.memberLastTask = memberLastTask;
  state.lastLeaderName = lastLeaderName;
  state.workingDayCounterCarry = workingDayCounter;
  state.lastWeekdayOncallTeamId = lastWeekdayOncallTeamId;

  return { schedule, nextState: state };
};
