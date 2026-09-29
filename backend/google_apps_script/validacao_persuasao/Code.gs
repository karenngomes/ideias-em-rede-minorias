const CONFIG = {
  taskSheet: 'Tarefas',
  paragraphSheet: 'Respostas_Paragrafos',
  humanSheet: 'Anotacoes_Humanas',
  llmSheet: 'Avaliacoes_LLM',
  assignmentSheet: 'Atribuicoes',
  participantSheet: 'Participantes',
  knownAnnotators: {
    thali: { name: 'Thali', email: 'thali@anotadores.local' },
    robson: { name: 'Robson', email: 'robson@anotadores.local' },
    karen: { name: 'Karen', email: 'karen@anotadores.local' }
  },
  annotationsPerTask: 2,
  categories: [
    'ataque_a_reputacao',
    'justificativa',
    'simplificacao',
    'distracao',
    'chamada',
    'linguagem_manipulativa'
  ]
};

function doGet() {
  setupValidationSheets_();
  syncTaskStatuses_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Validação de persuasão')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function registerParticipant(annotator, name, email) {
  annotator = String(annotator || '').trim().toLowerCase();
  const knownAnnotator = CONFIG.knownAnnotators[annotator];
  if (knownAnnotator) {
    name = knownAnnotator.name;
    email = knownAnnotator.email;
  } else if (annotator !== 'outro') {
    throw new Error('Selecione um anotador.');
  }
  name = String(name || '').trim();
  email = String(email || '').trim().toLowerCase();
  if (name.length < 2) throw new Error('Informe seu nome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  setupValidationSheets_();
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.participantSheet);
    const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues();
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i][2].toLowerCase() === email) {
        if (rows[i][1] !== name) sheet.getRange(i + 2, 2).setValue(name);
        return { name: name, email: email };
      }
    }
    const participantId = Utilities.getUuid();
    sheet.appendRow([participantId, name, email, new Date()]);
    return { name: name, email: email };
  } finally {
    lock.releaseLock();
  }
}

function getBootstrapData(email) {
  const participant = getParticipantByEmail_(email);
  setupValidationSheets_();
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    return {
      categories: CONFIG.categories,
      evaluator: participant.email.endsWith('@anotadores.local')
        ? participant.name
        : participant.name + ' · ' + participant.email,
      email: participant.email,
      stats: getStats_(participant.email),
      studyStats: getStudyStats_(),
      assignment: getOrAssignTask_(participant.email)
    };
  } finally {
    lock.releaseLock();
  }
}

function setupValidationSheets() {
  setupValidationSheets_();
  syncTaskStatuses_();
  return 'Abas de validação configuradas.';
}

function syncTaskStatuses() {
  setupValidationSheets_();
  syncTaskStatuses_();
  return 'Status das tarefas atualizados.';
}

function getStudyStats() {
  setupValidationSheets_();
  return getStudyStats_();
}

function saveHumanAnnotation(payload) {
  validateHumanPayload_(payload);
  const participant = getParticipantByEmail_(payload.email);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActive();
    assertAssignmentOwner_(payload.taskId, participant.email, ['Em andamento']);
    const evaluator = participant.participantId + ' | ' + participant.name + ' | ' + participant.email;
    const paragraphSheet = ss.getSheetByName(CONFIG.paragraphSheet);
    const humanSheet = ss.getSheetByName(CONFIG.humanSheet);
    const now = new Date();

    paragraphSheet.appendRow([
      now, payload.taskId, evaluator, payload.hasPersuasion ? 'Sim' : 'Não',
      payload.annotations.length, payload.startedAt || '', payload.elapsedSeconds || ''
    ]);

    payload.annotations.forEach(function(annotation, index) {
      humanSheet.appendRow([
        now, payload.taskId, evaluator, index + 1, annotation.category,
        annotation.explanation.trim(), annotation.evidence.trim()
      ]);
    });

    updateAssignmentStatus_(payload.taskId, participant.email, 'Em andamento', 'Anotação humana salva', '');

    return { task: getTaskById_(payload.taskId), modelAnnotations: getModelAnnotations_(payload.taskId) };
  } finally {
    lock.releaseLock();
  }
}

function saveLlmEvaluation(payload) {
  if (!payload || !payload.taskId || !Array.isArray(payload.evaluations)) {
    throw new Error('Avaliação da LLM inválida.');
  }
  const allowed = ['Concordo', 'Discordo', 'Concordo parcialmente'];
  const allowedErrors = [
    'Não se aplica',
    'O texto não contém persuasão, mas a LLM anotou mesmo assim',
    'Existe persuasão, mas a LLM errou a classe',
    'A explicação da LLM não faz sentido',
    'A classe está correta, mas a explicação está errada',
    'Nem a classe nem a explicação estão corretas',
    'Outro'
  ];
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const participant = getParticipantByEmail_(payload.email);
    const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.llmSheet);
    assertAssignmentOwner_(payload.taskId, participant.email, ['Anotação humana salva']);
    const evaluator = participant.participantId + ' | ' + participant.name + ' | ' + participant.email;
    const now = new Date();
    payload.evaluations.forEach(function(item, index) {
      if (allowed.indexOf(item.decision) === -1) {
        throw new Error('Informe sua decisão para cada anotação da LLM.');
      }
      const errorType = item.decision === 'Concordo' ? 'Não se aplica' : item.errorType;
      if (allowedErrors.indexOf(errorType) === -1 || (item.decision !== 'Concordo' && errorType === 'Não se aplica')) {
        throw new Error('Informe o tipo de erro da LLM.');
      }
      if (errorType === 'Outro' && !String(item.comment || '').trim()) {
        throw new Error('Descreva o erro no comentário quando selecionar Outro.');
      }
      sheet.appendRow([
        now, payload.taskId, evaluator, index + 1, item.category || '',
        item.evidence || '', item.explanation || '', item.decision,
        (item.comment || '').trim(), errorType
      ]);
    });
    if (payload.evaluations.length === 0) {
      sheet.appendRow([now, payload.taskId, evaluator, 0, '', '', '', 'Sem anotações da LLM', '', 'Não se aplica']);
    }
    completeAssignment_(payload.taskId, participant.email, now);
    return {
      stats: getStats_(participant.email),
      studyStats: getStudyStats_(),
      assignment: payload.finish ? null : getOrAssignTask_(participant.email),
      finished: Boolean(payload.finish)
    };
  } finally {
    lock.releaseLock();
  }
}

function setupValidationSheets_() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, CONFIG.paragraphSheet, [
    'timestamp', 'task_id', 'avaliador', 'existe_persuasao',
    'quantidade_anotacoes', 'inicio_avaliacao', 'duracao_segundos'
  ]);
  ensureSheet_(ss, CONFIG.humanSheet, [
    'timestamp', 'task_id', 'avaliador', 'indice_anotacao', 'categoria',
    'explicacao', 'trecho_evidencia'
  ]);
  ensureSheet_(ss, CONFIG.llmSheet, [
    'timestamp', 'task_id', 'avaliador', 'indice_anotacao_llm', 'categoria_llm',
    'trecho_llm', 'explicacao_llm', 'decisao', 'comentario', 'tipo_erro'
  ]);
  ensureSheet_(ss, CONFIG.assignmentSheet, [
    'timestamp_atribuicao', 'task_id', 'participante_id', 'email', 'status',
    'timestamp_conclusao'
  ]);
  ensureSheet_(ss, CONFIG.participantSheet, [
    'participante_id', 'nome', 'email', 'timestamp_cadastro'
  ]);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#173f51').setFontColor('#ffffff').setFontWeight('bold');
  if (sheet.getFrozenRows() === 0) {
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function getOrAssignTask_(email) {
  email = normalizeEmail_(email);
  const participant = getParticipantByEmail_(email);
  const assignmentSheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.assignmentSheet);
  const assignmentRows = assignmentSheet.getLastRow() < 2 ? [] :
    assignmentSheet.getRange(2, 1, assignmentSheet.getLastRow() - 1, 6).getDisplayValues();
  const active = assignmentRows.filter(function(row) {
    return normalizeEmail_(row[3]) === email &&
      (row[4] === 'Em andamento' || row[4] === 'Anotação humana salva');
  });
  if (active.length) {
    const activeTask = getTaskById_(active[0][1]);
    return {
      task: activeTask,
      phase: active[0][4] === 'Anotação humana salva' ? 'llm' : 'human',
      modelAnnotations: active[0][4] === 'Anotação humana salva' ? getModelAnnotations_(active[0][1]) : []
    };
  }

  const assignmentCounts = {};
  const participantTasks = {};
  const taskEmails = {};
  assignmentRows.forEach(function(row) {
    if (row[4] === 'Em andamento' || row[4] === 'Anotação humana salva' || row[4] === 'Concluída') {
      const rowEmail = normalizeEmail_(row[3]);
      taskEmails[row[1]] = taskEmails[row[1]] || {};
      if (rowEmail && !taskEmails[row[1]][rowEmail]) {
        taskEmails[row[1]][rowEmail] = true;
        assignmentCounts[row[1]] = (assignmentCounts[row[1]] || 0) + 1;
      }
      if (rowEmail === email) participantTasks[row[1]] = true;
    }
  });
  const available = taskRows_().filter(function(row) {
    const required = Number(row.anotadores_necessarios || CONFIG.annotationsPerTask);
    return !participantTasks[row.task_id] && (assignmentCounts[row.task_id] || 0) < required;
  });
  if (!available.length) return null;
  const minimumCoverage = Math.min.apply(null, available.map(function(row) {
    return assignmentCounts[row.task_id] || 0;
  }));
  const leastCovered = available.filter(function(row) {
    return (assignmentCounts[row.task_id] || 0) === minimumCoverage;
  });
  const selected = leastCovered[Math.floor(Math.random() * leastCovered.length)];
  assignmentSheet.appendRow([
    new Date(), selected.task_id, participant.participantId, participant.email, 'Em andamento', ''
  ]);
  return { task: normalizeTask_(selected), phase: 'human', modelAnnotations: [] };
}

function getTaskById_(taskId) {
  const rows = taskRows_();
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i].task_id) === String(taskId)) return normalizeTask_(rows[i]);
  }
  throw new Error('Tarefa não encontrada: ' + taskId);
}

function taskRows_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.taskSheet);
  if (!sheet) throw new Error('A aba Tarefas não foi encontrada.');
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function(row) { return row[0]; }).map(function(row) {
    const item = {};
    headers.forEach(function(header, index) { item[header] = row[index]; });
    return item;
  });
}

function normalizeTask_(row) {
  return {
    taskId: row.task_id,
    audienceId: row.audiencia_id,
    speechNumber: row.fala_numero,
    paragraphNumber: row.paragrafo_numero,
    speaker: row.orador,
    previousContext: row.contexto_anterior || '',
    targetText: row.texto_alvo || '',
    nextContext: row.contexto_posterior || '',
    nonLiteralWarning: String(row.possui_evidencia_nao_literal).toLowerCase() === 'true',
    alerts: row.alertas || ''
  };
}

function getModelAnnotations_(taskId) {
  const rows = taskRows_();
  const row = rows.filter(function(item) { return String(item.task_id) === String(taskId); })[0];
  if (!row) throw new Error('Tarefa não encontrada.');
  try {
    const parsed = JSON.parse(row.resposta_original_json || '{}');
    return (parsed.anotacoes || []).map(function(item) {
      return {
        category: normalizeCategory_(item.categoria),
        evidence: item.trecho || '',
        explanation: item.explicacao || ''
      };
    });
  } catch (error) {
    throw new Error('Não foi possível interpretar a resposta da LLM nesta tarefa.');
  }
}

function normalizeCategory_(value) {
  const key = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aliases = {
    'attack on reputation': 'ataque_a_reputacao', 'ataque a reputacao': 'ataque_a_reputacao',
    'justification': 'justificativa', 'justificativa': 'justificativa',
    'simplification': 'simplificacao', 'simplificacao': 'simplificacao',
    'distraction': 'distracao', 'distracao': 'distracao',
    'call': 'chamada', 'chamada': 'chamada',
    'manipulative wording': 'linguagem_manipulativa',
    'linguagem manipulativa': 'linguagem_manipulativa', 'nenhuma': 'nenhuma'
  };
  return aliases[key] || key.replace(/\s+/g, '_');
}

function validateHumanPayload_(payload) {
  if (!payload || !payload.taskId || !payload.email || typeof payload.hasPersuasion !== 'boolean') {
    throw new Error('Resposta humana inválida.');
  }
  if (!Array.isArray(payload.annotations)) throw new Error('Anotações inválidas.');
  if (payload.hasPersuasion && payload.annotations.length === 0) {
    throw new Error('Adicione pelo menos uma anotação.');
  }
  if (!payload.hasPersuasion && payload.annotations.length > 0) {
    throw new Error('Uma resposta sem persuasão não pode ter categorias.');
  }
  payload.annotations.forEach(function(item) {
    if (CONFIG.categories.indexOf(item.category) === -1) throw new Error('Categoria inválida.');
    if (!String(item.explanation || '').trim()) throw new Error('Preencha a explicação.');
    if (!String(item.evidence || '').trim()) throw new Error('Preencha o trecho de evidência.');
  });
}

function completedTaskIds_(email) {
  email = normalizeEmail_(email);
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.assignmentSheet);
  const result = {};
  if (!sheet || sheet.getLastRow() < 2) return result;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues().forEach(function(row) {
    if (normalizeEmail_(row[3]) === email && row[4] === 'Concluída') result[row[1]] = true;
  });
  return result;
}

function getStats_(email) {
  const total = taskRows_().length;
  const completed = Object.keys(completedTaskIds_(email)).length;
  return { total: total, completed: completed };
}

function getStudyStats_() {
  const tasks = taskRows_();
  const totalRequired = tasks.reduce(function(total, task) {
    return total + (Number(task.anotadores_necessarios) || CONFIG.annotationsPerTask);
  }, 0);
  const ss = SpreadsheetApp.getActive();
  const participantSheet = ss.getSheetByName(CONFIG.participantSheet);
  const assignmentSheet = ss.getSheetByName(CONFIG.assignmentSheet);
  const participantsByEmail = {};

  Object.keys(CONFIG.knownAnnotators).forEach(function(key) {
    const participant = CONFIG.knownAnnotators[key];
    participantsByEmail[participant.email] = { name: participant.name, email: participant.email, completed: 0 };
  });
  if (participantSheet && participantSheet.getLastRow() >= 2) {
    participantSheet.getRange(2, 1, participantSheet.getLastRow() - 1, 4).getDisplayValues().forEach(function(row) {
      const email = normalizeEmail_(row[2]);
      if (email) participantsByEmail[email] = { name: row[1], email: email, completed: 0 };
    });
  }

  const completedPairs = {};
  let totalCompleted = 0;
  if (assignmentSheet && assignmentSheet.getLastRow() >= 2) {
    assignmentSheet.getRange(2, 1, assignmentSheet.getLastRow() - 1, 6).getDisplayValues().forEach(function(row) {
      if (row[4] !== 'Concluída') return;
      const email = normalizeEmail_(row[3]);
      const pairKey = String(row[1]) + '|' + email;
      if (!email || completedPairs[pairKey]) return;
      completedPairs[pairKey] = true;
      totalCompleted += 1;
      if (!participantsByEmail[email]) participantsByEmail[email] = { name: email, email: email, completed: 0 };
      participantsByEmail[email].completed += 1;
    });
  }

  const knownOrder = { 'thali@anotadores.local': 0, 'robson@anotadores.local': 1, 'karen@anotadores.local': 2 };
  const participants = Object.keys(participantsByEmail).map(function(email) {
    const participant = participantsByEmail[email];
    return { name: participant.name, email: email, completed: participant.completed };
  }).sort(function(a, b) {
    const aOrder = Object.prototype.hasOwnProperty.call(knownOrder, a.email) ? knownOrder[a.email] : 99;
    const bOrder = Object.prototype.hasOwnProperty.call(knownOrder, b.email) ? knownOrder[b.email] : 99;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  }).map(function(participant) {
    return { name: participant.name, completed: participant.completed };
  });
  return {
    participants: participants,
    totalCompleted: totalCompleted,
    totalRequired: totalRequired,
    remaining: Math.max(totalRequired - totalCompleted, 0)
  };
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function getParticipantByEmail_(email) {
  email = normalizeEmail_(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.participantSheet);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('Participante não cadastrado.');
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues();
  for (let i = 0; i < rows.length; i += 1) {
    if (normalizeEmail_(rows[i][2]) === email) {
      return { participantId: rows[i][0], name: rows[i][1], email: email };
    }
  }
  throw new Error('Participante não cadastrado.');
}

function assertAssignmentOwner_(taskId, email, allowedStatuses) {
  email = normalizeEmail_(email);
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.assignmentSheet);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('A tarefa não está reservada.');
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues();
  const valid = rows.some(function(row) {
    return row[1] === taskId && normalizeEmail_(row[3]) === email && allowedStatuses.indexOf(row[4]) !== -1;
  });
  if (!valid) throw new Error('Esta tarefa não está reservada para este participante.');
}

function updateAssignmentStatus_(taskId, email, currentStatus, newStatus, completedAt) {
  email = normalizeEmail_(email);
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.assignmentSheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues();
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i][1] === taskId && normalizeEmail_(rows[i][3]) === email && rows[i][4] === currentStatus) {
      sheet.getRange(i + 2, 5, 1, 2).setValues([[newStatus, completedAt || '']]);
      return;
    }
  }
  throw new Error('Não foi possível concluir a atribuição desta tarefa.');
}

function completeAssignment_(taskId, email, completedAt) {
  updateAssignmentStatus_(taskId, email, 'Anotação humana salva', 'Concluída', completedAt);
  syncTaskStatuses_();
}

function syncTaskStatuses_() {
  const ss = SpreadsheetApp.getActive();
  const taskSheet = ss.getSheetByName(CONFIG.taskSheet);
  const assignmentSheet = ss.getSheetByName(CONFIG.assignmentSheet);
  if (!taskSheet || taskSheet.getLastRow() < 2) return;

  const taskValues = taskSheet.getDataRange().getDisplayValues();
  const headers = taskValues[0];
  const taskIdIndex = headers.indexOf('task_id');
  const statusIndex = headers.indexOf('status');
  const requiredIndex = headers.indexOf('anotadores_necessarios');
  if (taskIdIndex === -1 || statusIndex === -1) {
    throw new Error('A aba Tarefas precisa das colunas task_id e status.');
  }

  const completedByTask = {};
  const completedEmailsByTask = {};
  if (assignmentSheet && assignmentSheet.getLastRow() >= 2) {
    const assignments = assignmentSheet
      .getRange(2, 1, assignmentSheet.getLastRow() - 1, 6)
      .getDisplayValues();
    assignments.forEach(function(row) {
      if (row[4] !== 'Concluída') return;
      const taskId = String(row[1]);
      const email = normalizeEmail_(row[3]);
      completedEmailsByTask[taskId] = completedEmailsByTask[taskId] || {};
      if (email && !completedEmailsByTask[taskId][email]) {
        completedEmailsByTask[taskId][email] = true;
        completedByTask[taskId] = (completedByTask[taskId] || 0) + 1;
      }
    });
  }

  const statuses = taskValues.slice(1).map(function(row) {
    const taskId = String(row[taskIdIndex] || '');
    if (!taskId) return [row[statusIndex]];
    const completed = completedByTask[taskId] || 0;
    const required = Number(requiredIndex === -1 ? CONFIG.annotationsPerTask : row[requiredIndex]) || CONFIG.annotationsPerTask;
    if (completed >= required) return ['Concluída'];
    if (completed > 0) return ['Em andamento'];
    return ['Pendente'];
  });
  taskSheet.getRange(2, statusIndex + 1, statuses.length, 1).setValues(statuses);
}
