module.exports.getProject = async ({ team, project }) => {
  const key = `${team}::${project}`;
  const projectData = await PROJECTS.get(key, 'json'); 
  return projectData || null;
};

module.exports.listProjects = async ({ team }) => {
  const allProjects = await PROJECTS.list({ prefix: `${team}::` });
  const projects = await Promise.all(
    allProjects.keys.map(async ({ key }) => {
      const projectData = await PROJECTS.get(key, 'json');
      return projectData;
    })
  );
  return projects;
};

module.exports.createProject = async ({ team, project }) => {
  const key = `${team}::${project}`;
  const existingProject = await PROJECTS.get(key, 'json');
  if (existingProject) {
    throw new Error(`Project "${project}" already exists for team "${team}".`);
  }
  const projectData = {
    team,
    project,
    key,
    updated: new Date().toISOString(),
  };
  await PROJECTS.put(key, JSON.stringify(projectData));
  return projectData;
};

module.exports.updateProjectName = async ({ project, name }) => {
  const projectData = await PROJECTS.get(project, 'json');
  if (!projectData) {
    throw new Error(`Project with key "${project}" does not exist.`);
  }
  const teamKey = projectData.team; 
  const newProjectKey = `${teamKey}::${name}`;
  const existingProject = await PROJECTS.get(newProjectKey, 'json');
  if (existingProject) {
    throw new Error(`Project with name "${name}" already exists in team "${teamKey}".`);
  }
  projectData.project = name;
  await PROJECTS.delete(project); 
  await PROJECTS.put(newProjectKey, JSON.stringify(projectData)); 
  return projectData;
};

module.exports.deleteProject = async ({ project, team }) => {
  let stages = [];
  try {
    const stageKeys = await STAGES.list({ prefix: `${team}::` });
    console.log("deleteProject:stageKeys....", stageKeys);
    stages = stageKeys.keys;
    if (stages.length === 0) {
      console.log(`No stages found for project "${project}" in team "${team}".`);
    }
  } catch (error) {
    console.error(`Failed to fetch stages for project "${project}" in team "${team}". Error:`, error);
    throw new Error(`Error fetching stages for project "${project}".`);
  }
  if (stages.length > 0) {
    try {
      await Promise.all(
        stages.map(({ name }) => {
          return Promise.all([STAGES.delete(name), KV.delete(name)]);
        })
      );
      console.log(`Successfully deleted stages for project "${project}" in team "${team}".`);
    } catch (error) {
      console.error(`Failed to delete stages for project "${project}" in team "${team}". Error:`, error);
      throw new Error(`Error deleting stages for project "${project}".`);
    }
  }
  try {
    const deleteResponse = await PROJECTS.delete(project);
    console.log('PROJECTS.delete response:', deleteResponse); 
    console.log(`Successfully deleted project "${project}" from team "${team}".`);
  } catch (error) {
    console.error(`Failed to delete project "${project}" from team "${team}". Error:`, error);
    throw new Error(`Error deleting project "${project}".`);
  }
  return project;
};
