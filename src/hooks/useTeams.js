
import { useState, useEffect } from 'react';
import { initialTeams } from '../data/initialTeams.js';

const TEAMS_STORAGE_KEY = 'teamsData';

export const useTeams = () => {
    const [teams, setTeams] = useState(() => {
        try {
            const storedTeams = localStorage.getItem(TEAMS_STORAGE_KEY);
            return storedTeams ? JSON.parse(storedTeams) : initialTeams;
        } catch (error) {
            console.error("Error reading from localStorage", error);
            return initialTeams;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
        } catch (error) {
            console.error("Error writing to localStorage", error);
        }
    }, [teams]);

    const addTeam = (name) => {
        const newTeam = {
            id: `team-${new Date().getTime()}-${Math.random().toString(36).substring(2, 9)}`,
            name,
            leader: 'تعیین نشده',
            members: [],
        };
        setTeams(prevTeams => [...prevTeams, newTeam]);
    };

    const updateTeam = (updatedTeam) => {
        setTeams(prevTeams => 
            prevTeams.map(team => (team.id === updatedTeam.id ? updatedTeam : team))
        );
    };

    const deleteTeam = (teamId) => {
        setTeams(prevTeams => prevTeams.filter(team => team.id !== teamId));
    };

    const addMember = (teamId, memberName) => {
        setTeams(prevTeams =>
            prevTeams.map(team => {
                if (team.id === teamId && !team.members.includes(memberName)) {
                    return {
                        ...team,
                        members: [...team.members, memberName],
                    };
                }
                return team;
            })
        );
    };

    const deleteMember = (teamId, memberName) => {
        setTeams(prevTeams =>
            prevTeams.map(team => {
                if (team.id === teamId) {
                    return {
                        ...team,
                        members: team.members.filter(member => member !== memberName),
                    };
                }
                return team;
            })
        );
    };

    return { teams, addTeam, updateTeam, deleteTeam, addMember, deleteMember };
};
