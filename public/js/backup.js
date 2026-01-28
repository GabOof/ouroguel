// Configuração de backup
const BACKUP_CONFIG = {
  autoBackup: true,
  backupInterval: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
  maxBackups: 30, // Mantém últimos 30 backups
  backupPath: "backups/",
};

// Inicializar sistema de backup
function initBackupSystem() {
  if (!BACKUP_CONFIG.autoBackup) return;

  // Verificar se é administrador
  if (!checkPermission("admin")) return;

  // Executar backup periódico
  setInterval(async () => {
    try {
      await realizarBackupAutomatico();
    } catch (error) {
      console.error("Erro no backup automático:", error);
    }
  }, BACKUP_CONFIG.backupInterval);

  // Executar primeiro backup após 1 minuto
  setTimeout(async () => {
    try {
      await realizarBackupAutomatico();
    } catch (error) {
      console.error("Erro no backup inicial:", error);
    }
  }, 60000);
}

// Função para realizar backup automático
async function realizarBackupAutomatico() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `backup_auto_${timestamp}`;

    console.log(`Iniciando backup automático: ${backupName}`);

    // Realizar backup
    const backupData = await criarBackupCompleto();

    // Salvar no localStorage (para backups pequenos)
    salvarBackupLocal(backupName, backupData);

    // Limitar número de backups
    gerenciarBackupsLocais();

    console.log("Backup automático concluído com sucesso!");
  } catch (error) {
    console.error("Erro no backup automático:", error);
  }
}

// Função para criar backup completo
async function criarBackupCompleto() {
  console.log("Coletando dados para backup...");

  const backup = {
    metadata: {
      sistema: "Ouroguel Locação de Equipamentos",
      versao: "1.0.0",
      dataCriacao: new Date().toISOString(),
      totalRegistros: 0,
    },
    dados: {},
  };

  // Coleções para backup
  const collections = [
    "clientes",
    "equipamentos",
    "alugueis",
    "usuarios",
    "historico_ajustes",
  ];

  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      const data = [];

      snapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      backup.dados[collectionName] = data;
      backup.metadata.totalRegistros += data.length;

      console.log(`✓ ${collectionName}: ${data.length} registros`);
    } catch (error) {
      console.error(`Erro ao fazer backup de ${collectionName}:`, error);
      backup.dados[collectionName] = [];
    }
  }

  return backup;
}

// Função para salvar backup localmente
function salvarBackupLocal(backupName, backupData) {
  try {
    // Converter para JSON compactado
    const backupString = JSON.stringify(backupData);

    // Salvar no localStorage
    localStorage.setItem(`backup_${backupName}`, backupString);

    // Atualizar lista de backups
    const backups = JSON.parse(localStorage.getItem("backup_list") || "[]");
    backups.unshift({
      nome: backupName,
      data: new Date().toISOString(),
      tamanho: backupString.length,
      registros: backupData.metadata.totalRegistros,
    });

    // Manter apenas os últimos BACKUP_CONFIG.maxBackups
    backups.splice(BACKUP_CONFIG.maxBackups);
    localStorage.setItem("backup_list", JSON.stringify(backups));

    console.log(
      `Backup salvo localmente: ${backupName} (${backupString.length} bytes)`,
    );
  } catch (error) {
    console.error("Erro ao salvar backup local:", error);
  }
}

// Função para gerenciar backups locais
function gerenciarBackupsLocais() {
  try {
    const backups = JSON.parse(localStorage.getItem("backup_list") || "[]");

    if (backups.length > BACKUP_CONFIG.maxBackups) {
      // Remover backups antigos
      const backupsParaRemover = backups.slice(BACKUP_CONFIG.maxBackups);

      backupsParaRemover.forEach((backup) => {
        localStorage.removeItem(`backup_${backup.nome}`);
        console.log(`Backup antigo removido: ${backup.nome}`);
      });

      // Atualizar lista
      const backupsAtuais = backups.slice(0, BACKUP_CONFIG.maxBackups);
      localStorage.setItem("backup_list", JSON.stringify(backupsAtuais));
    }
  } catch (error) {
    console.error("Erro ao gerenciar backups:", error);
  }
}

// Função para exportar dados para JSON
async function exportarParaJSON() {
  try {
    mostrarCarregamentoBackup();

    const backupData = await criarBackupCompleto();
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `backup_ouroguel_${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();

    mostrarMensagem("Sucesso", "Backup exportado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao exportar backup:", error);
    mostrarMensagem(
      "Erro",
      "Falha ao exportar backup: " + error.message,
      "error",
    );
  } finally {
    esconderCarregamentoBackup();
  }
}

// Função para importar dados de JSON
async function importarDeJSON(event) {
  const file = event.target.files[0];

  if (!file) return;

  if (
    !confirm(
      `ATENÇÃO: Esta ação irá RESTAURAR dados do arquivo ${file.name}. Deseja continuar?`,
    )
  ) {
    return;
  }

  try {
    mostrarCarregamentoBackup();

    const fileText = await file.text();
    const backupData = JSON.parse(fileText);

    // Validar estrutura do backup
    if (!backupData.metadata || !backupData.dados) {
      throw new Error("Arquivo de backup inválido");
    }

    // Restaurar dados
    await restaurarBackup(backupData);

    mostrarMensagem("Sucesso", "Backup restaurado com sucesso!", "success");

    // Recarregar página para refletir mudanças
    setTimeout(() => location.reload(), 2000);
  } catch (error) {
    console.error("Erro ao importar backup:", error);
    mostrarMensagem(
      "Erro",
      "Falha ao restaurar backup: " + error.message,
      "error",
    );
  } finally {
    esconderCarregamentoBackup();
    // Limpar input file
    event.target.value = "";
  }
}

// Função para restaurar backup
async function restaurarBackup(backupData) {
  console.log("Iniciando restauração de backup...");

  const collections = Object.keys(backupData.dados);

  for (const collectionName of collections) {
    const data = backupData.dados[collectionName];

    if (!data || !Array.isArray(data)) continue;

    console.log(`Restaurando ${collectionName}: ${data.length} registros`);

    // Para cada documento na coleção
    for (const docData of data) {
      try {
        const { id, ...documentData } = docData;

        if (id) {
          // Usar ID original se disponível
          await db.collection(collectionName).doc(id).set(documentData);
        } else {
          // Criar novo documento
          await db.collection(collectionName).add(documentData);
        }
      } catch (error) {
        console.error(
          `Erro ao restaurar documento em ${collectionName}:`,
          error,
        );
      }
    }
  }

  console.log("Restauração de backup concluída!");
}

// Função para mostrar carregamento de backup
function mostrarCarregamentoBackup() {
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "backup-loading";
  loadingDiv.innerHTML = `
        <div class="backup-loading-content">
            <i class="fas fa-sync fa-spin"></i>
            <p>Processando backup...</p>
            <p class="small">Não feche esta janela</p>
        </div>
    `;
  loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 18px;
    `;

  document.body.appendChild(loadingDiv);
}

// Função para esconder carregamento de backup
function esconderCarregamentoBackup() {
  const loadingDiv = document.getElementById("backup-loading");
  if (loadingDiv) loadingDiv.remove();
}

// Função para exibir gerenciador de backups na interface
function mostrarGerenciadorBackups() {
  const backups = JSON.parse(localStorage.getItem("backup_list") || "[]");

  let html = `
        <div class="backup-manager">
            <h3><i class="fas fa-database"></i> Gerenciador de Backups</h3>
            
            <div class="backup-actions">
                <button class="btn btn-primary" onclick="exportarParaJSON()">
                    <i class="fas fa-download"></i> Exportar Backup Atual
                </button>
                <label class="btn btn-secondary">
                    <i class="fas fa-upload"></i> Importar Backup
                    <input type="file" accept=".json" style="display: none;" 
                           onchange="importarDeJSON(event)">
                </label>
                <button class="btn btn-success" onclick="criarBackupManual()">
                    <i class="fas fa-plus"></i> Criar Backup Manual
                </button>
            </div>
            
            <div class="backup-list">
                <h4>Backups Locais (${backups.length})</h4>
    `;

  if (backups.length === 0) {
    html += `<p class="empty">Nenhum backup local encontrado</p>`;
  } else {
    html += `
            <table>
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Data</th>
                        <th>Registros</th>
                        <th>Tamanho</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;

    backups.forEach((backup) => {
      const dataFormatada = new Date(backup.data).toLocaleString("pt-BR");
      const tamanhoKB = Math.round(backup.tamanho / 1024);

      html += `
                <tr>
                    <td>${backup.nome}</td>
                    <td>${dataFormatada}</td>
                    <td>${backup.registros}</td>
                    <td>${tamanhoKB} KB</td>
                    <td>
                        <button class="btn btn-small btn-primary" onclick="restaurarBackupLocal('${backup.nome}')">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="btn btn-small btn-danger" onclick="excluirBackupLocal('${backup.nome}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
    });

    html += `</tbody></table>`;
  }

  html += `
            </div>
            <div class="backup-info">
                <p><i class="fas fa-info-circle"></i> 
                Backups são salvos localmente no navegador. Para backup permanente, exporte para um arquivo.</p>
            </div>
        </div>
    `;

  // Criar modal
  const modal = document.createElement("div");
  modal.className = "modal-backup";
  modal.innerHTML = html;
  modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;

  // Adicionar estilos
  if (!document.querySelector("#backup-styles")) {
    const styles = document.createElement("style");
    styles.id = "backup-styles";
    styles.textContent = `
            .backup-manager {
                background: white;
                border-radius: 10px;
                padding: 30px;
                max-width: 800px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            .backup-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin: 20px 0;
            }
            
            .backup-list table {
                width: 100%;
                margin: 20px 0;
            }
            
            .backup-list th {
                background: #2c3e50;
                color: white;
                padding: 10px;
            }
            
            .backup-list td {
                padding: 10px;
                border-bottom: 1px solid #eee;
            }
            
            .backup-info {
                margin-top: 20px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 5px;
                font-size: 14px;
            }
            
            .empty {
                text-align: center;
                padding: 40px;
                color: #7f8c8d;
            }
            
            .backup-loading-content {
                text-align: center;
            }
            
            .backup-loading-content i {
                font-size: 48px;
                margin-bottom: 20px;
            }
            
            .backup-loading-content .small {
                font-size: 14px;
                opacity: 0.8;
            }
        `;
    document.head.appendChild(styles);
  }

  // Adicionar botão de fechar
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        font-size: 24px;
        color: white;
        cursor: pointer;
    `;
  closeBtn.onclick = () => modal.remove();
  modal.appendChild(closeBtn);

  document.body.appendChild(modal);
}

// Função para criar backup manual
async function criarBackupManual() {
  try {
    mostrarCarregamentoBackup();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `backup_manual_${timestamp}`;

    const backupData = await criarBackupCompleto();
    salvarBackupLocal(backupName, backupData);

    mostrarMensagem("Sucesso", "Backup manual criado com sucesso!", "success");

    // Atualizar lista
    setTimeout(() => {
      document.querySelector(".modal-backup")?.remove();
      mostrarGerenciadorBackups();
    }, 1000);
  } catch (error) {
    mostrarMensagem("Erro", "Erro ao criar backup: " + error.message, "error");
  } finally {
    esconderCarregamentoBackup();
  }
}

// Função para restaurar backup local
async function restaurarBackupLocal(backupName) {
  if (
    !confirm(
      `ATENÇÃO: Esta ação irá RESTAURAR dados do backup ${backupName}. Deseja continuar?`,
    )
  ) {
    return;
  }

  try {
    mostrarCarregamentoBackup();

    const backupString = localStorage.getItem(`backup_${backupName}`);

    if (!backupString) {
      throw new Error("Backup não encontrado");
    }

    const backupData = JSON.parse(backupString);
    await restaurarBackup(backupData);

    mostrarMensagem("Sucesso", "Backup restaurado com sucesso!", "success");

    setTimeout(() => location.reload(), 2000);
  } catch (error) {
    mostrarMensagem(
      "Erro",
      "Erro ao restaurar backup: " + error.message,
      "error",
    );
  } finally {
    esconderCarregamentoBackup();
  }
}

// Função para excluir backup local
function excluirBackupLocal(backupName) {
  if (
    !confirm(`Excluir backup ${backupName}? Esta ação não pode ser desfeita.`)
  ) {
    return;
  }

  localStorage.removeItem(`backup_${backupName}`);

  // Atualizar lista
  const backups = JSON.parse(localStorage.getItem("backup_list") || "[]");
  const index = backups.findIndex((b) => b.nome === backupName);

  if (index > -1) {
    backups.splice(index, 1);
    localStorage.setItem("backup_list", JSON.stringify(backups));
  }

  mostrarMensagem("Sucesso", "Backup excluído com sucesso!", "success");

  // Atualizar lista
  setTimeout(() => {
    document.querySelector(".modal-backup")?.remove();
    mostrarGerenciadorBackups();
  }, 500);
}

// Adicionar menu de backup na interface (apenas para administradores)
function addBackupMenu() {
  if (!checkPermission("admin")) return;

  // Adicionar ao menu principal
  const nav = document.querySelector(".nav ul");
  if (nav) {
    const backupItem = document.createElement("li");
    backupItem.innerHTML = `
            <a href="#" onclick="mostrarGerenciadorBackups(); return false;">
                <i class="fas fa-database"></i> Backup
            </a>
        `;
    nav.appendChild(backupItem);
  }

  // Inicializar sistema de backup
  initBackupSystem();
}

// Inicializar quando a página carregar
if (checkPermission("admin")) {
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(addBackupMenu, 1000);
  });
}
