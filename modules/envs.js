module.exports.getStage = async ({ team, project, stage = 'dev' }) => {
  const key = `${team}::${project}::${stage}`;
  const stageData = await STAGES.get(key, 'json');
  return stageData;
};

module.exports.listStages = async ({ team, project }) => {
  const prefix = `${team}::${project}::`;
  const { keys } = await STAGES.list({ prefix });
  
  const stages = await Promise.all(
    keys.map(async ({ name }) => {
      const stageData = await STAGES.get(name, 'json');
      return stageData;
    })
  );
  
  return { stages };
};

module.exports.createStage = async ({ team, project, stage }) => {
  const key = `${team}::${project}::${stage}`;

  const existingStage = await STAGES.get(key, 'json');
  if (existingStage) {
    throw new Error(`Stage "${stage}" already exists for project "${project}" in team "${team}".`);
  }

  const stageData = {
    team,
    project: `${team}::${project}`,
    stage,
    key,
    updated: new Date(),
    vars: 0,
  };

  await STAGES.put(key, JSON.stringify(stageData));

  return stageData;
};

module.exports.deleteStage = async (stageKey) => {
  await Promise.all([
    STAGES.delete(stageKey),
    KV.delete(stageKey),
  ]);
};

module.exports.updateStageVars = async ({ stage, updates }) => {
  const key = stage;
  const updated = new Date();

  let kvVars = await KV.get(key, { type: 'json' }) || {};
  let varsChange = 0;
  let changes = 0;

  Object.entries(updates).forEach(([action, items]) => {
    changes += Object.keys(items).length;
    
    if (action === 'add') {
      varsChange += Object.keys(items).length;
      kvVars = { ...kvVars, ...items };
    } else if (action === 'remove') {
      varsChange -= items.length;
      items.forEach((varKey) => {
        delete kvVars[varKey];
      });
    } else if (action === 'edit') {
      kvVars = { ...kvVars, ...items };
    }
  });

  const actions = [];

  if (varsChange !== 0) {
    const stageData = await STAGES.get(key, 'json');
    
    if (stageData) {
      stageData.vars = (stageData.vars || 0) + varsChange;
      stageData.updated = updated;
      actions.push(STAGES.put(key, JSON.stringify(stageData)));
    } else {
      console.warn(`Stage ${key} not found in STAGES KV`);
    }
  }

  actions.push(KV.put(key, JSON.stringify(kvVars), { metadata: { updated } }));

  await Promise.all(actions);

  return changes;
};

module.exports.getKVEnvs = async ({ team, p, stage }) => {
  const key = `${team}::${p}::${stage}`;
  const kvVars = await KV.get(key, { type: 'json' });
  return kvVars;
};
