const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'whatspanda', 'Chat.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const declaredVars = new Set();
const usagesBeforeDeclaration = [];

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  
  // Detectar declarações simples
  const declMatch = line.match(/^\s*(?:const|let|function)\s+(\w+)/);
  if (declMatch) {
    declaredVars.add(declMatch[1]);
  }
  
  // Procurar por uso em hooks antes de serem declaradas
  // Ex: useEffect, useMemo, useCallback
  const hookMatch = line.match(/(?:useEffect|useMemo|useCallback)\(\(\)\s*=>\s*\{|,\s*\[([^\]]+)\]\)/);
  if (hookMatch) {
    // Se for o array de dependências
    const depsPart = line.match(/,\s*\[([^\]]+)\]\)/);
    if (depsPart) {
      const deps = depsPart[1].split(',').map(d => d.trim());
      deps.forEach(dep => {
        if (dep && !declaredVars.has(dep) && !['dep', 'activeProfile', 'profile', 'currentUser', 'isAdmin', 'isGhostMode', 'onConversationSelect', 'initialSearch', 'type', 'initialConversationId', 'conversations', 'selectedConversation', 'messages', 'searchTerm', 'selectedMedia', 'newMessage', 'messageContextMenu', 'editingMessageId', 'editingText', 'isRecording', 'recordingTime', 'settings', 'activeTab', 'filterAssignee', 'chatTypeFilter', 'connections', 'queues', 'agents', 'userQueues', 'realtimeDebounceRef', 'fetchConversationsRef', 'channelAccess', 'accessibleChannelIds', 'filterPlatform'].includes(dep)) {
          // Checar se é uma variável declarada posteriormente
          usagesBeforeDeclaration.push({ lineNum, dep, type: 'hook-dep' });
        }
      });
    }
  }
});

console.log("Usos de variáveis antes da declaração textual:");
usagesBeforeDeclaration.forEach(u => {
  console.log(`Linha ${u.lineNum}: '${u.dep}' usada como dependência antes de ser declarada.`);
});
