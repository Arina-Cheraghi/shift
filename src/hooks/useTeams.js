import { useEffect, useState } from 'react';
import { initialTeams } from '../data/initialTeams.js';

const TEAMS_STORAGE_KEY = 'teamsData';
const NAME_ALIAS_MAP = {
  'الناز سادات ابن التراب': 'الناز ابن تراب',
  'الناز سادات ابن تراب': 'الناز ابن تراب',
};

const normalizeName = (name) => {
  if (!name) return name;
  const cleaned = String(name).trim().replace(/\s+/g, ' ');
  return NAME_ALIAS_MAP[cleaned] || cleaned;
};

const normalizeTeams = (teams) => {
  if (!Array.isArray(teams)) return [];
  return teams.map((team) => ({
    ...team,
    leader: normalizeName(team.leader),
    members: Array.from(new Set((team.members || []).map(normalizeName))),
  }));
};

export const useTeams = () => {
  const [teams, setTeams] = useState(() => {
    try {
      const storedTeams = localStorage.getItem(TEAMS_STORAGE_KEY);
      const parsed = storedTeams ? JSON.parse(storedTeams) : initialTeams;
      return normalizeTeams(parsed);
    } catch (error) {
      console.error('Error reading from localStorage', error);
      return normalizeTeams(initialTeams);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(normalizeTeams(teams)));
    } catch (error) {
      console.error('Error writing to localStorage', error);
    }
  }, [teams]);

  const addTeam = (name) => {
    const newTeam = {
      id: `team-${new Date().getTime()}-${Math.random().toString(36).substring(2, 9)}`,
      name: normalizeName(name),
      leader: 'تعیین نشده',
      members: [],
    };
    setTeams((prevTeams) => [...prevTeams, newTeam]);
  };

  const updateTeam = (updatedTeam) => {
    setTeams((prevTeams) => prevTeams.map((team) => (
      team.id === updatedTeam.id
        ? {
            ...updatedTeam,
            leader: normalizeName(updatedTeam.leader),
            members: Array.from(new Set((updatedTeam.members || []).map(normalizeName))),
          }
        : team
    )));
  };

  const deleteTeam = (teamId) => {
    setTeams((prevTeams) => prevTeams.filter((team) => team.id !== teamId));
  };

  const addMember = (teamId, memberName) => {
    const normalizedMember = normalizeName(memberName);
    setTeams((prevTeams) => prevTeams.map((team) => {
      if (team.id !== teamId) return team;
      if (team.members.includes(normalizedMember)) return team;
      return {
        ...team,
        members: [...team.members, normalizedMember],
      };
    }));
  };

  const deleteMember = (teamId, memberName) => {
    const normalizedMember = normalizeName(memberName);
    setTeams((prevTeams) => prevTeams.map((team) => {
      if (team.id !== teamId) return team;
      return {
        ...team,
        members: team.members.filter((member) => member !== normalizedMember),
      };
    }));
  };

  return { teams, addTeam, updateTeam, deleteTeam, addMember, deleteMember };
};
