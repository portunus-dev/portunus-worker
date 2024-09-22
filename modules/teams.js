const { v4: uuidv4 } = require('uuid')
const { addUserToTeam, removeUserFromTeam, addUserToAdmin } = require('./users');
const { deleteProject } = require('./projects');

module.exports.updateTeamAudit = async ({ team, audit }) => {
  const teamData = await AUDIT_REPORT.get(team, 'json');
  if (!teamData) {
    throw new Error(`Team with key ${team} not found`);
  }
  const updatedTeamData = {
    ...teamData,
    audit, 
  };
  await AUDIT_REPORT.put(team, JSON.stringify(updatedTeamData));
  return updatedTeamData;
};

module.exports.createTeam = async ({ name, user }) => {
  const userData = await USERS.get(user.email, "json");
  const teamExists = (userData.teams || []).some((team) => team.name === name);
  if (teamExists) {
    throw new Error(`A team with the name "${name}" already exists for this user.`);
  }
  const teamKey = uuidv4();
  const teamData = { name, audit: false, key: teamKey };
  await TEAMS.put(teamKey, JSON.stringify(teamData));
  await addUserToTeam({ user, team: { key: teamKey, name: name } });
  await addUserToAdmin({ user, team: { key: teamKey, name: name } });
  return teamKey;
};

module.exports.getTeam = async (key) => {
  const teamData = await TEAMS.get(key, "json"); 
  return teamData || null;
};

module.exports.listTeams = async ({ user }) => {
  const nonAdminTeams = await Promise.all(
    user.teams
      .filter((team) => !(user.admins || []).includes(team.key)) 
      .map(async (team) => {
        const teamKey = team.key;
        const teamData = await TEAMS.get(teamKey, "json");
        console.log("listTeams:teamKey...", teamKey) 
        if (!teamData) {
          console.error(`Team data for key ${teamKey} not found`);
          return null;  
        }
        return { ...teamData, admin: false }; 
      })
  );
  const validNonAdminTeams = nonAdminTeams.filter(team => team !== null);
  const adminTeams = await Promise.all(
    (user.admins || []).map(async (teamKey) => {
      const teamData = await TEAMS.get(teamKey, "json"); 
      if (!teamData) {
        console.error(`Admin team data for key ${teamKey} not found`);
        return null; 
      }
      return { ...teamData, admin: true }; 
    })
  );
  const validAdminTeams = adminTeams.filter(team => team !== null);
  return [...validNonAdminTeams, ...validAdminTeams];
};

module.exports.updateTeamName = async (req) => {
  const { user, team, name } = req;
  console.log('Request Object:', req);
  const userEmail = user.email;
  const userData = await USERS.get(userEmail, "json");
  if (!userData) {
    throw new Error(`User with email ${userEmail} does not exist.`);
  }
  const teamData = await TEAMS.get(team, "json");
  if (!teamData) {
    throw new Error(`Team with key ${team} does not exist.`);
  }
  if (!user.admins.includes(team)) {
    throw new Error(`Unauthorized: You do not have admin access to update the team.`);
  }
  const duplicateNameExists = (userData.teams || []).some((t) => t.name === name && t.key !== team);
  if (duplicateNameExists) {
    throw new Error(`A team with the name "${name}" already exists for this user.`);
  }
  teamData.name = name;
  await TEAMS.put(team, JSON.stringify(teamData));
  const updatedTeams = (userData.teams || []).filter(t => t.key !== team);
  updatedTeams.push({ key: team, name: name });
  const updatedUser = {
    ...userData,
    teams: updatedTeams,
  };
  await USERS.put(userEmail, JSON.stringify(updatedUser));
  return new Response(JSON.stringify({ success: true, key: team, newName: name }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

module.exports.deleteTeam = async ({ team }) => {
  try {
    const projectKeys = await PROJECTS.list({ prefix: `${team}::` });
    if (projectKeys.keys.length > 0) {
      await Promise.all(
        projectKeys.keys.map(async ({ name }) => {
          await deleteProject({ project: name, team }); 
        })
      );
    }    
    } catch (e) {
      console.warn('Error fetching or deleting projects from KV:', e);
    }
  try {
    await TEAMS.delete(team);
  } catch (e) {
    console.warn(`Failed to delete team with key ${team}:`, e);
  }
  try {
    const allUsers = await USERS.list(); 
    users = await Promise.all(
      allUsers.keys.map(async ({ name: userEmail }) => {
        const userData = await USERS.get(userEmail, "json");
        if (userData) {
          const isInTeams = userData.teams.some((t) => t.key === team);
          const isInAdmins = (userData.admins || []).includes(team);
          if (isInTeams || isInAdmins) {
            await removeUserFromTeam({ user: userData, team });
          }
        }
        return null;
      })
    );
  } catch (e) {
    console.warn('Error updating users:', e);
  }
  return team;
};
