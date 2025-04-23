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

module.exports.updateProjectName = async ({ project: oldProjectKey, name: newProjectName }) => {
  console.log(`Starting updateProjectName for old key: ${oldProjectKey}, new name: ${newProjectName}`);

  // 1. Fetch Old Project Data & Validate
  let oldProjectData;
  try {
    oldProjectData = await PROJECTS.get(oldProjectKey, 'json');
    if (!oldProjectData) {
      throw new Error(`Project with key "${oldProjectKey}" does not exist.`);
    }
  } catch (error) {
    console.error(`Error fetching project "${oldProjectKey}":`, error);
    throw new Error(`Failed to retrieve project data for key "${oldProjectKey}". Original error: ${error.message}`);
  }

  const teamKey = oldProjectData.team;
  const oldProjectName = oldProjectData.project; // Get the actual old name from data

  // Early exit if name hasn't changed
  if (oldProjectName === newProjectName) {
    console.log(`New name "${newProjectName}" is the same as the old name. No update needed.`);
    return oldProjectData;
  }

  const newProjectKey = `${teamKey}::${newProjectName}`;

  // 2. Check for New Name Conflict (Ensure target project key is free)
   try {
     const existingProject = await PROJECTS.get(newProjectKey); // Check existence is enough
     if (existingProject !== null) { // Check if the key exists
       throw new Error(`Project with name "${newProjectName}" already exists in team "${teamKey}" (key: ${newProjectKey}).`);
     }
   } catch (error) {
     if (error.message.includes('already exists')) {
         console.error(`Conflict check failed: New project key "${newProjectKey}" already exists.`, error);
         throw error; 
     }
     console.warn(`Potential issue during new key check for "${newProjectKey}" (but not a conflict error):`, error);
   }

  // 3. List Associated Stages based on the OLD project name
  const oldStagePrefix = `${teamKey}::${oldProjectName}::`;
  let oldStageKeys = [];
  try {
    const listedStages = await STAGES.list({ prefix: oldStagePrefix });
    // Make sure listedStages and listedStages.keys exist before accessing
    if (listedStages && listedStages.keys) {
        oldStageKeys = listedStages.keys;
    }
    console.log(`Found ${oldStageKeys.length} stages with prefix "${oldStagePrefix}" to migrate.`);
  } catch (error) {
    console.error(`Failed to list stages for old project "${oldProjectKey}" with prefix "${oldStagePrefix}":`, error);
    throw new Error(`Error listing stages for migration for project "${oldProjectName}". Original error: ${error.message}`);
  }

  // 4. Migrate Related STAGES and KV Data using String.replace
  if (oldStageKeys.length > 0) {
    console.log(`Starting migration of ${oldStageKeys.length} stages and associated KV pairs...`);
    const newStagePrefix = `${teamKey}::${newProjectName}::`; // Define new prefix for replacement

    try {
      const migrationPromises = oldStageKeys.map(async ({ name: oldStageKey }) => {

        if (!oldStageKey.startsWith(oldStagePrefix)) {
             console.error(`  - Error: Stage key "${oldStageKey}" does not start with expected prefix "${oldStagePrefix}". Skipping migration for this key.`);
             return;
        }
        const newStageKey = oldStageKey.replace(oldStagePrefix, newStagePrefix);

        console.log(`Migrating stage: ${oldStageKey} -> ${newStageKey}`);

        let stageDataJson = null;
        try {
            stageDataJson = await STAGES.get(oldStageKey, 'json'); // Fetch as JSON object
        } catch (getStageError) {
            console.warn(`  - Warning: Failed to get STAGE data for key ${oldStageKey}. Skipping STAGE migration. Error: ${getStageError.message}`);
        }

        if (stageDataJson !== null) {
          const updatedStageData = {
             ...stageDataJson,
             project: newProjectKey, 
             key: newStageKey,       
             updated: new Date().toISOString() 
          };

          try {
            await STAGES.put(newStageKey, JSON.stringify(updatedStageData));
            await STAGES.delete(oldStageKey);
            console.log(`  - Stage entry migrated (data updated): ${oldStageKey} -> ${newStageKey}`);
          } catch (putDeleteStageError) {
             console.error(`  - Error migrating STAGE entry ${oldStageKey} -> ${newStageKey}. Error: ${putDeleteStageError.message}`);
          }
        } else if (!getStageError) { 
           console.warn(`  - Warning: No JSON data found for stage key ${oldStageKey} during migration.`);
        }

        let kvData = null;
        let getKvError = null;
        try {
            kvData = await KV.get(oldStageKey); 
        } catch(err) {
            getKvError = err;
            console.warn(`  - Warning: Failed to get KV data for key ${oldStageKey}. Skipping KV migration. Error: ${err.message}`);
        }

         if (kvData !== null) {
           try {
               await KV.put(newStageKey, kvData);    
               await KV.delete(oldStageKey);
               console.log(`  - KV entry migrated (raw value): ${oldStageKey} -> ${newStageKey}`);
           } catch (putDeleteKvError) {
               console.error(`  - Error migrating KV entry ${oldStageKey} -> ${newStageKey}. Error: ${putDeleteKvError.message}`);
           }
         } else if (!getKvError) {
         }
      }); 

      await Promise.all(migrationPromises);
      console.log(`Finished migration attempt for ${oldStageKeys.length} stages and associated KV pairs.`);
    } catch (error) {
      console.error(`Critical failure during the migration process for project "${oldProjectName}". Error:`, error);
      throw new Error(`Error migrating stages/KV data for project "${oldProjectName}". State might be inconsistent. Original error: ${error.message}`);
    }
  } else {
      console.log(`No stages found with prefix "${oldStagePrefix}". Skipping migration.`);
  }

  // 5. Update the Main Project Entry
  const updatedProjectData = {
    ...oldProjectData, // Preserve other fields from the original data
    project: newProjectName,
    key: newProjectKey,
    updated: new Date().toISOString(),
  };

  try {
    await PROJECTS.put(newProjectKey, JSON.stringify(updatedProjectData));
    console.log(`Successfully created new project entry with key: ${newProjectKey}`);

    await PROJECTS.delete(oldProjectKey);
    console.log(`Successfully deleted old project entry with key: ${oldProjectKey}`);

  } catch (error) {
    console.error(`Failed to update project entry from "${oldProjectKey}" to "${newProjectKey}". Error:`, error);
    throw new Error(`Error finalizing project rename from "${oldProjectName}" to "${newProjectName}". Original error: ${error.message}`);
  }
  console.log(`Successfully updated project name to "${newProjectName}" with key "${newProjectKey}".`);
  return updatedProjectData;
};

module.exports.deleteProject = async ({ project, team }) => {
  let stages = [];
  const projectName = project.split('::')[1];
  try {
    const stageKeys = await STAGES.list({ prefix: `${team}::${projectName}` });
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
