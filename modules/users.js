const { v4: uuidv4 } = require('uuid')

module.exports.fetchUser = async (email) => {
  const user = await USERS.get(email, 'json');
  return user || null;
};

module.exports.getUser = async (email) => {
  const user = await USERS.get(email, 'json'); 
  return user || null;
};

module.exports.listTeamUsers = async ({ team }) => {
  const allUsers = await USERS.list(); 
  const teamUsers = await Promise.all(
    allUsers.keys.map(async ({ name: userKey }) => {
      const userData = await USERS.get(userKey, 'json');
      const isTeamMember = (userData.teams || []).some(t => t.key === team || t === team);
      const isAdmin = (userData.admins || []).includes(team);
      if (isTeamMember || isAdmin) {
        const transformedUser = {
          key: userKey, 
          email: userData.email,
          otp_secret: userData.otp_secret,
          jwt_uuid: userData.jwt_uuid,
          teams: userData.teams.map(t => (typeof t === 'string' ? t : t.key)), 
          admins: userData.admins || [],
          audit: userData.audit || false,
          updated: userData.updated, 
        };
        return transformedUser; 
      }
      return null; 
    })
  );
  return teamUsers.filter(user => user !== null);
};

module.exports.createUser = async (email, { getKVUser = false } = {}) => {
  const lowercasedEmail = email.toLowerCase();
  const user = {
    email: lowercasedEmail,
    jwt_uuid: uuidv4(),
    otp_secret: uuidv4(),
    teams: [], 
    admins: [], 
    updated: new Date(),
    audit: false,
  };
  if (user.jwt_uuid === user.otp_secret) {
    throw new Error('jwt_uuid and otp_secret must be different');
  }
  await USERS.put(lowercasedEmail, JSON.stringify(user)); 
  const kvUser = { ...user };
  delete kvUser.otp_secret;
  return getKVUser ? kvUser : user;
};

module.exports.updateUser = async (user) => {
  if (!user.key) {
    throw new Error('user.key is required');
  }
  await USERS.put(user.email, JSON.stringify(user));
  return user; 
};

module.exports.addUserToTeam = async ({ user, team }) => {
  if (!team || !team.key || !team.name) {
    throw new Error('Invalid team object. Key or name is missing.');
  }
  const userData = await USERS.get(user.email, "json");
  const teamExists = (userData.teams || []).some((t) => t.name === team.name);
  if (teamExists) {
    return; 
  }
  const updatedUser = {
    ...userData,
    teams: [...(userData.teams || []), { key: team.key, name: team.name }],
  };
  if (!userData.admins.includes(team.key)) {
    updatedUser.admins = [...(userData.admins || []), team.key];
  }
  await USERS.put(user.email, JSON.stringify(updatedUser));
};

module.exports.removeUserFromTeam = async ({ user, team }) => {
  const admins = (user.admins || []).filter((t) => t !== team);
  const teams = user.teams.filter((t) => t.key !== team);
  const updatedUser = {
    ...user,
    teams,
    admins,
  };
  await USERS.put(user.email, JSON.stringify(updatedUser));
  return updatedUser;
};

module.exports.addUserToAdmin = async ({ user, team }) => {
  if (!team || !team.key || !team.name) {
    throw new Error('Invalid team object. Key or name is missing.');
  }
  const userData = await USERS.get(user.email, "json");
  const adminExists = (userData.admins || []).includes(team.key);
  if (adminExists) {
    return; 
  }
  const updatedUser = {
    ...userData,
    admins: [...(userData.admins || []), team.key],
  };
  await USERS.put(user.email, JSON.stringify(updatedUser));
};

module.exports.removeUserFromAdmin = async ({ user, team }) => {
  if (!user.admins) {
    throw new Error('User does not have an admins field.');
  }
  const updatedAdmins = user.admins.filter((t) => t !== team);
  if (updatedAdmins.length === user.admins.length) {
    throw new Error('Team not found in user\'s admin list.');
  }
  await USERS.put(
    user.email,
    JSON.stringify({
      ...user,
      admins: updatedAdmins,
    })
  );
  return { success: true, message: "Admin removed successfully." };
};

module.exports.deleteUser = async (user) => {
  if (!user.key) {
    throw new Error('user.key is required');
  }
  if (!user.email) {
    throw new Error('user.email is required');
  }
  await USERS.delete(user.email);
  return { success: true };
};

module.exports.getKVUser = (email) => USERS.get(email, { type: 'json' })
