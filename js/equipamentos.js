// Variáveis globais
let equipamentos = [];
let equipamentoEditando = null;

// Inicialização quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", function () {
  carregarEquipamentos();
  atualizarEstatisticas();

  // Configurar formulário
  const form = document.getElementById("equipamentoForm");
  if (form) {
    form.addEventListener("submit", salvarEquipamento);
  }

  // Configurar validação de números
  const inputsNumeros = document.querySelectorAll('input[type="number"]');
  inputsNumeros.forEach((input) => {
    input.addEventListener("change", function () {
      if (this.value < 0) this.value = 0;
    });
  });
});

// Função para salvar equipamento
async function salvarEquipamento(event) {
  event.preventDefault();

  // Coletar dados do formulário
  const dadosEquipamento = {
    nomeEquipamento: document.getElementById("nomeEquipamento").value.trim(),
    categoria: document.getElementById("categoria").value,
    quantidadeTotal:
      parseInt(document.getElementById("quantidadeTotal").value) || 0,
    valorHora: parseFloat(document.getElementById("valorHora").value) || 0,
    valorDia: parseFloat(document.getElementById("valorDia").value) || 0,
    valorMes: parseFloat(document.getElementById("valorMes").value) || 0,
    status: document.getElementById("status").value,
    observacoes: document.getElementById("observacoes").value.trim(),
    dataCadastro: new Date().toISOString(),
    // Inicializar quantidade disponível como total
    quantidadeDisponivel:
      parseInt(document.getElementById("quantidadeTotal").value) || 0,
    quantidadeAlugada: 0,
  };

  // Validações
  if (!dadosEquipamento.nomeEquipamento) {
    mostrarMensagem("Erro", "Nome do equipamento é obrigatório", "error");
    document.getElementById("nomeEquipamento").focus();
    return;
  }

  if (dadosEquipamento.quantidadeTotal < 0) {
    mostrarMensagem("Erro", "Quantidade não pode ser negativa", "error");
    document.getElementById("quantidadeTotal").focus();
    return;
  }

  if (dadosEquipamento.valorDia <= 0) {
    mostrarMensagem("Erro", "Valor por dia deve ser maior que zero", "error");
    document.getElementById("valorDia").focus();
    return;
  }

  try {
    let resultado;

    if (equipamentoEditando) {
      // Manter quantidades atuais se existirem
      const equipamentoAtual = await db
        .collection("equipamentos")
        .doc(equipamentoEditando)
        .get();
      if (equipamentoAtual.exists) {
        const dadosAtuais = equipamentoAtual.data();
        dadosEquipamento.quantidadeDisponivel =
          dadosAtuais.quantidadeDisponivel || dadosEquipamento.quantidadeTotal;
        dadosEquipamento.quantidadeAlugada = dadosAtuais.quantidadeAlugada || 0;
      }

      // Atualizar equipamento existente
      resultado = await db
        .collection("equipamentos")
        .doc(equipamentoEditando)
        .update(dadosEquipamento);
      mostrarMensagem("Sucesso", "Equipamento atualizado com sucesso!");
    } else {
      // Adicionar novo equipamento
      resultado = await db.collection("equipamentos").add(dadosEquipamento);
      mostrarMensagem("Sucesso", "Equipamento cadastrado com sucesso!");
    }

    // Limpar formulário
    limparFormularioEquipamento();

    // Recarregar lista e estatísticas
    carregarEquipamentos();
    atualizarEstatisticas();
  } catch (error) {
    console.error("Erro ao salvar equipamento:", error);
    mostrarMensagem(
      "Erro",
      "Erro ao salvar equipamento: " + error.message,
      "error",
    );
  }
}

// Função para carregar equipamentos
async function carregarEquipamentos() {
  try {
    const equipamentosList = document.getElementById("equipamentosList");
    if (!equipamentosList) return;

    // Mostrar indicador de carregamento
    equipamentosList.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
                    <p>Carregando equipamentos...</p>
                </td>
            </tr>
        `;

    // Buscar equipamentos no Firestore
    const snapshot = await db
      .collection("equipamentos")
      .orderBy("nomeEquipamento")
      .get();

    if (snapshot.empty) {
      equipamentosList.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-message">
                        <i class="fas fa-box"></i>
                        <p>Nenhum equipamento cadastrado ainda</p>
                    </td>
                </tr>
            `;
      equipamentos = [];
      return;
    }

    // Limpar array
    equipamentos = [];

    // Construir HTML da lista
    let html = "";
    snapshot.forEach((doc) => {
      const equipamento = {
        id: doc.id,
        ...doc.data(),
      };
      equipamentos.push(equipamento);

      // Determinar classe de status
      let statusClass = "status-available";
      let statusIcon = "fa-check-circle";
      let statusText = "Disponível";

      if (equipamento.status === "indisponivel") {
        statusClass = "status-unavailable";
        statusIcon = "fa-times-circle";
        statusText = "Indisponível";
      } else if (equipamento.status === "manutencao") {
        statusClass = "status-warning";
        statusIcon = "fa-wrench";
        statusText = "Manutenção";
      } else if (equipamento.quantidadeDisponivel <= 0) {
        statusClass = "status-unavailable";
        statusIcon = "fa-times-circle";
        statusText = "Esgotado";
      }

      html += `
                <tr>
                    <td>
                        <strong>${equipamento.nomeEquipamento || ""}</strong>
                        ${equipamento.observacoes ? `<br><small>${equipamento.observacoes.substring(0, 50)}${equipamento.observacoes.length > 50 ? "..." : ""}</small>` : ""}
                    </td>
                    <td>${equipamento.categoria || ""}</td>
                    <td>
                        <strong>${equipamento.quantidadeTotal || 0}</strong>
                        <small style="display: block; color: #666;">
                            Disp: ${equipamento.quantidadeDisponivel || 0} | 
                            Alug: ${equipamento.quantidadeAlugada || 0}
                        </small>
                    </td>
                    <td>${formatarMoeda(equipamento.valorDia || 0)}</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <i class="fas ${statusIcon}"></i>
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                            <button class="btn btn-small btn-primary" onclick="editarEquipamento('${equipamento.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-small btn-success" onclick="selecionarEquipamentoParaAluguel('${equipamento.id}')">
                                <i class="fas fa-handshake"></i>
                            </button>
                            <button class="btn btn-small btn-danger" onclick="excluirEquipamento('${equipamento.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    equipamentosList.innerHTML = html;
  } catch (error) {
    console.error("Erro ao carregar equipamentos:", error);
    equipamentosList.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar equipamentos</p>
                </td>
            </tr>
        `;
  }
}

// Função para buscar equipamentos
function buscarEquipamentos() {
  const termo = document
    .getElementById("searchEquipamentos")
    .value.toLowerCase();
  const linhas = document.querySelectorAll("#equipamentosList tr");

  linhas.forEach((linha) => {
    const textoLinha = linha.textContent.toLowerCase();
    if (textoLinha.includes(termo)) {
      linha.style.display = "";
    } else {
      linha.style.display = "none";
    }
  });
}

// Função para editar equipamento
async function editarEquipamento(equipamentoId) {
  try {
    const doc = await db.collection("equipamentos").doc(equipamentoId).get();

    if (doc.exists) {
      const equipamento = doc.data();
      equipamentoEditando = equipamentoId;

      // Preencher formulário
      document.getElementById("nomeEquipamento").value =
        equipamento.nomeEquipamento || "";
      document.getElementById("categoria").value = equipamento.categoria || "";
      document.getElementById("quantidadeTotal").value =
        equipamento.quantidadeTotal || 0;
      document.getElementById("valorHora").value = equipamento.valorHora || 0;
      document.getElementById("valorDia").value = equipamento.valorDia || 0;
      document.getElementById("valorMes").value = equipamento.valorMes || 0;
      document.getElementById("status").value =
        equipamento.status || "disponivel";
      document.getElementById("observacoes").value =
        equipamento.observacoes || "";

      // Alterar texto do botão
      const botaoSalvar = document.querySelector(
        '#equipamentoForm button[type="submit"]',
      );
      if (botaoSalvar) {
        botaoSalvar.innerHTML =
          '<i class="fas fa-sync-alt"></i> Atualizar Equipamento';
      }

      // Rolagem suave até o formulário
      document.querySelector(".form-section").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      mostrarMensagem(
        "Informação",
        "Editando equipamento. Modifique os dados e clique em Atualizar.",
      );
    }
  } catch (error) {
    console.error("Erro ao carregar equipamento para edição:", error);
    mostrarMensagem(
      "Erro",
      "Não foi possível carregar o equipamento para edição",
      "error",
    );
  }
}

// Função para excluir equipamento
async function excluirEquipamento(equipamentoId) {
  if (
    !confirm(
      "Tem certeza que deseja excluir este equipamento?\n\nEsta ação não pode ser desfeita.",
    )
  ) {
    return;
  }

  try {
    // Verificar se há aluguéis ativos para este equipamento
    const alugueisSnapshot = await db
      .collection("alugueis")
      .where("equipamentos", "array-contains", equipamentoId)
      .where("status", "==", "ativo")
      .get();

    if (!alugueisSnapshot.empty) {
      mostrarMensagem(
        "Atenção",
        "Não é possível excluir este equipamento pois existem aluguéis ativos relacionados a ele.",
        "warning",
      );
      return;
    }

    await db.collection("equipamentos").doc(equipamentoId).delete();
    mostrarMensagem("Sucesso", "Equipamento excluído com sucesso!");
    carregarEquipamentos();
    atualizarEstatisticas();
  } catch (error) {
    console.error("Erro ao excluir equipamento:", error);
    mostrarMensagem(
      "Erro",
      "Erro ao excluir equipamento: " + error.message,
      "error",
    );
  }
}

// Função para selecionar equipamento para aluguel
function selecionarEquipamentoParaAluguel(equipamentoId) {
  // Redirecionar para página de aluguel com o equipamento pré-selecionado
  localStorage.setItem("equipamentoSelecionado", equipamentoId);
  window.location.href = "aluguel.html";
}

// Função para atualizar estatísticas
async function atualizarEstatisticas() {
  try {
    const snapshot = await db.collection("equipamentos").get();

    let totalEquipamentos = 0;
    let totalDisponivel = 0;
    let totalIndisponivel = 0;
    let totalManutencao = 0;

    snapshot.forEach((doc) => {
      const equipamento = doc.data();
      totalEquipamentos++;

      if (
        equipamento.status === "disponivel" &&
        (equipamento.quantidadeDisponivel || 0) > 0
      ) {
        totalDisponivel++;
      } else if (equipamento.status === "indisponivel") {
        totalIndisponivel++;
      } else if (equipamento.status === "manutencao") {
        totalManutencao++;
      }
    });

    // Atualizar elementos HTML
    document.getElementById("totalEquipamentos").textContent =
      totalEquipamentos;
    document.getElementById("totalDisponivel").textContent = totalDisponivel;
    document.getElementById("totalIndisponivel").textContent =
      totalIndisponivel;
    document.getElementById("totalManutencao").textContent = totalManutencao;
  } catch (error) {
    console.error("Erro ao atualizar estatísticas:", error);
  }
}

// Função para limpar formulário
function limparFormularioEquipamento() {
  document.getElementById("equipamentoForm").reset();
  equipamentoEditando = null;

  // Restaurar texto do botão
  const botaoSalvar = document.querySelector(
    '#equipamentoForm button[type="submit"]',
  );
  if (botaoSalvar) {
    botaoSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Equipamento';
  }

  // Definir valores padrão
  document.getElementById("status").value = "disponivel";
  document.getElementById("quantidadeTotal").value = 1;
  document.getElementById("valorHora").value = 0;
  document.getElementById("valorDia").value = 0;
  document.getElementById("valorMes").value = 0;

  // Focar no primeiro campo
  document.getElementById("nomeEquipamento").focus();
}
