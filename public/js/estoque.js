// Variáveis globais
let estoque = [];
let ajustesHistorico = [];

// Inicialização quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", function () {
  carregarEstoque();
  carregarHistoricoAjustes();
  carregarEquipamentosParaSelect("ajusteEquipamento", false);

  // Configurar filtros
  document
    .getElementById("filtroCategoria")
    .addEventListener("change", filtrarEstoque);
  document
    .getElementById("filtroStatus")
    .addEventListener("change", filtrarEstoque);
  document
    .getElementById("filtroBusca")
    .addEventListener("keyup", filtrarEstoque);
});

// Função para carregar estoque
async function carregarEstoque() {
  try {
    const estoqueList = document.getElementById("estoqueList");
    if (!estoqueList) return;

    // Mostrar indicador de carregamento
    estoqueList.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
                    <p>Carregando estoque...</p>
                </td>
            </tr>
        `;

    // Buscar equipamentos no Firestore
    const snapshot = await db
      .collection("equipamentos")
      .orderBy("nomeEquipamento")
      .get();

    if (snapshot.empty) {
      estoqueList.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-message">
                        <i class="fas fa-clipboard-list"></i>
                        <p>Nenhum equipamento cadastrado no estoque</p>
                    </td>
                </tr>
            `;
      estoque = [];
      atualizarEstatisticasEstoque();
      return;
    }

    // Limpar array
    estoque = [];

    // Construir HTML da lista
    let html = "";
    snapshot.forEach((doc) => {
      const item = {
        id: doc.id,
        ...doc.data(),
      };
      estoque.push(item);

      // Determinar status
      let statusClass = "status-available";
      let statusText = "Disponível";
      let statusIcon = "fa-check-circle";

      if (item.status === "indisponivel") {
        statusClass = "status-unavailable";
        statusText = "Indisponível";
        statusIcon = "fa-times-circle";
      } else if (item.status === "manutencao") {
        statusClass = "status-warning";
        statusText = "Manutenção";
        statusIcon = "fa-wrench";
      } else if ((item.quantidadeDisponivel || 0) <= 0) {
        statusClass = "status-unavailable";
        statusText = "Esgotado";
        statusIcon = "fa-times-circle";
      } else if ((item.quantidadeAlugada || 0) > 0) {
        statusClass = "status-info";
        statusText = "Parcial";
        statusIcon = "fa-clock";
      }

      // Calcular porcentagem disponível
      const porcentagemDisponivel =
        item.quantidadeTotal > 0
          ? Math.round((item.quantidadeDisponivel / item.quantidadeTotal) * 100)
          : 0;

      html += `
                <tr>
                    <td>
                        <strong>${item.nomeEquipamento || ""}</strong>
                        <br><small>${item.categoria || ""}</small>
                    </td>
                    <td>${item.categoria || ""}</td>
                    <td>${item.quantidadeTotal || 0}</td>
                    <td>
                        <strong style="color: ${
                          porcentagemDisponivel >= 50
                            ? "#27ae60"
                            : porcentagemDisponivel >= 25
                              ? "#f39c12"
                              : "#e74c3c"
                        }">
                            ${item.quantidadeDisponivel || 0}
                        </strong>
                        <div style="width: 100px; height: 8px; background: #eee; border-radius: 4px; margin-top: 5px;">
                            <div style="width: ${porcentagemDisponivel}%; height: 100%; background: ${
                              porcentagemDisponivel >= 50
                                ? "#27ae60"
                                : porcentagemDisponivel >= 25
                                  ? "#f39c12"
                                  : "#e74c3c"
                            }; border-radius: 4px;"></div>
                        </div>
                    </td>
                    <td>${item.quantidadeAlugada || 0}</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <i class="fas ${statusIcon}"></i>
                            ${statusText}
                        </span>
                    </td>
                    <td>${formatarMoeda(item.valorDia || 0)}</td>
                    <td>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                            <button class="btn btn-small btn-primary" onclick="ajustarEstoqueRapido('${item.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-small btn-info" onclick="visualizarDetalhes('${item.id}')">
                                <i class="fas fa-chart-bar"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    estoqueList.innerHTML = html;

    // Atualizar estatísticas
    atualizarEstatisticasEstoque();
  } catch (error) {
    console.error("Erro ao carregar estoque:", error);
    estoqueList.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar estoque</p>
                </td>
            </tr>
        `;
  }
}

// Função para filtrar estoque
function filtrarEstoque() {
  const categoria = document
    .getElementById("filtroCategoria")
    .value.toLowerCase();
  const status = document.getElementById("filtroStatus").value;
  const busca = document.getElementById("filtroBusca").value.toLowerCase();

  const linhas = document.querySelectorAll("#estoqueList tr");
  let visiveis = 0;

  linhas.forEach((linha) => {
    if (linha.cells.length < 2) return; // Pular linha de cabeçalho ou mensagem

    const textoLinha = linha.textContent.toLowerCase();
    const dadosCategoria = linha.cells[1]?.textContent.toLowerCase() || "";
    const dadosStatus =
      linha.querySelector(".status-badge")?.textContent.toLowerCase() || "";

    let mostrar = true;

    // Filtrar por categoria
    if (categoria && !dadosCategoria.includes(categoria)) {
      mostrar = false;
    }

    // Filtrar por status
    if (status) {
      if (status === "disponivel" && !dadosStatus.includes("disponível"))
        mostrar = false;
      if (status === "alugado" && !dadosStatus.includes("parcial"))
        mostrar = false;
      if (
        status === "indisponivel" &&
        !dadosStatus.includes("indisponível") &&
        !dadosStatus.includes("esgotado")
      )
        mostrar = false;
      if (status === "manutencao" && !dadosStatus.includes("manutenção"))
        mostrar = false;
    }

    // Filtrar por busca
    if (busca && !textoLinha.includes(busca)) {
      mostrar = false;
    }

    if (mostrar) {
      linha.style.display = "";
      visiveis++;
    } else {
      linha.style.display = "none";
    }
  });

  // Mostrar mensagem se nenhum item for encontrado
  if (visiveis === 0) {
    const tbody = document.querySelector("#estoqueList");
    if (!tbody.querySelector(".no-results")) {
      const tr = document.createElement("tr");
      tr.className = "no-results";
      tr.innerHTML = `
                <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-search"></i>
                    <p>Nenhum equipamento encontrado com os filtros selecionados</p>
                </td>
            `;
      tbody.appendChild(tr);
    }
  } else {
    const noResults = document.querySelector(".no-results");
    if (noResults) noResults.remove();
  }
}

// Função para limpar filtros
function limparFiltros() {
  document.getElementById("filtroCategoria").value = "";
  document.getElementById("filtroStatus").value = "";
  document.getElementById("filtroBusca").value = "";

  const linhas = document.querySelectorAll("#estoqueList tr");
  linhas.forEach((linha) => {
    linha.style.display = "";
  });

  const noResults = document.querySelector(".no-results");
  if (noResults) noResults.remove();
}

// Função para atualizar estatísticas do estoque
function atualizarEstatisticasEstoque() {
  let totalItens = 0;
  let disponiveis = 0;
  let alugados = 0;
  let indisponiveis = 0;

  estoque.forEach((item) => {
    totalItens++;

    if (item.status === "disponivel" && (item.quantidadeDisponivel || 0) > 0) {
      disponiveis++;
    }

    if ((item.quantidadeAlugada || 0) > 0) {
      alugados++;
    }

    if (
      item.status === "indisponivel" ||
      (item.quantidadeDisponivel || 0) <= 0
    ) {
      indisponiveis++;
    }
  });

  // Atualizar elementos HTML
  document.getElementById("totalItens").textContent = totalItens;
  document.getElementById("disponiveis").textContent = disponiveis;
  document.getElementById("alugados").textContent = alugados;
  document.getElementById("indisponiveis").textContent = indisponiveis;
}

// Função para ajuste rápido de estoque
function ajustarEstoqueRapido(equipamentoId) {
  const equipamento = estoque.find((item) => item.id === equipamentoId);

  if (equipamento) {
    document.getElementById("ajusteEquipamento").value = equipamentoId;
    document.getElementById("ajusteQuantidade").focus();
    document.getElementById("ajusteMotivo").value = "Ajuste manual";

    // Rolagem suave até o formulário de ajuste
    document.querySelector(".form-section:last-child").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    mostrarMensagem(
      "Informação",
      `Pronto para ajustar o estoque de: ${equipamento.nomeEquipamento}`,
    );
  }
}

// Função para realizar ajuste de estoque
async function realizarAjuste() {
  const equipamentoId = document.getElementById("ajusteEquipamento").value;
  const tipo = document.getElementById("ajusteTipo").value;
  const quantidade =
    parseInt(document.getElementById("ajusteQuantidade").value) || 1;
  const motivo = document.getElementById("ajusteMotivo").value.trim();

  if (!equipamentoId) {
    mostrarMensagem("Erro", "Selecione um equipamento", "error");
    return;
  }

  if (!motivo) {
    mostrarMensagem("Erro", "Informe o motivo do ajuste", "error");
    return;
  }

  try {
    const equipamentoRef = db.collection("equipamentos").doc(equipamentoId);
    const equipamentoDoc = await equipamentoRef.get();

    if (!equipamentoDoc.exists) {
      mostrarMensagem("Erro", "Equipamento não encontrado", "error");
      return;
    }

    const equipamento = equipamentoDoc.data();
    let atualizacoes = {};

    // Calcular novos valores baseados no tipo de ajuste
    switch (tipo) {
      case "entrada":
        atualizacoes = {
          quantidadeTotal: (equipamento.quantidadeTotal || 0) + quantidade,
          quantidadeDisponivel:
            (equipamento.quantidadeDisponivel || 0) + quantidade,
        };
        break;

      case "saida":
        if (quantidade > (equipamento.quantidadeDisponivel || 0)) {
          mostrarMensagem(
            "Erro",
            "Quantidade insuficiente em estoque",
            "error",
          );
          return;
        }
        atualizacoes = {
          quantidadeTotal: Math.max(
            0,
            (equipamento.quantidadeTotal || 0) - quantidade,
          ),
          quantidadeDisponivel: Math.max(
            0,
            (equipamento.quantidadeDisponivel || 0) - quantidade,
          ),
        };
        break;

      case "manutencao":
        if (quantidade > (equipamento.quantidadeDisponivel || 0)) {
          mostrarMensagem(
            "Erro",
            "Quantidade insuficiente em estoque",
            "error",
          );
          return;
        }
        atualizacoes = {
          quantidadeDisponivel: Math.max(
            0,
            (equipamento.quantidadeDisponivel || 0) - quantidade,
          ),
          status: "manutencao",
        };
        break;

      case "retorno":
        atualizacoes = {
          quantidadeDisponivel:
            (equipamento.quantidadeDisponivel || 0) + quantidade,
          status: "disponivel",
        };
        break;
    }

    // Atualizar equipamento
    await equipamentoRef.update(atualizacoes);

    // Registrar no histórico
    await registrarHistoricoAjuste(
      equipamentoId,
      equipamento.nomeEquipamento,
      tipo,
      quantidade,
      motivo,
    );

    mostrarMensagem("Sucesso", "Ajuste realizado com sucesso!");

    // Limpar formulário e recarregar dados
    limparAjuste();
    carregarEstoque();
    carregarHistoricoAjustes();
  } catch (error) {
    console.error("Erro ao realizar ajuste:", error);
    mostrarMensagem(
      "Erro",
      "Erro ao realizar ajuste: " + error.message,
      "error",
    );
  }
}

// Função para registrar histórico de ajuste
async function registrarHistoricoAjuste(
  equipamentoId,
  equipamentoNome,
  tipo,
  quantidade,
  motivo,
) {
  try {
    const dadosHistorico = {
      equipamentoId: equipamentoId,
      equipamentoNome: equipamentoNome,
      tipo: tipo,
      quantidade: quantidade,
      motivo: motivo,
      data: new Date().toISOString(),
      usuario: "Sistema", // Em um sistema real, aqui viria do usuário logado
    };

    await db.collection("historico_ajustes").add(dadosHistorico);
  } catch (error) {
    console.error("Erro ao registrar histórico:", error);
  }
}

// Função para carregar histórico de ajustes
async function carregarHistoricoAjustes() {
  try {
    const historicoList = document.getElementById("historicoList");
    if (!historicoList) return;

    // Mostrar indicador de carregamento
    historicoList.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
                    <p>Carregando histórico...</p>
                </td>
            </tr>
        `;

    // Buscar histórico no Firestore
    const snapshot = await db
      .collection("historico_ajustes")
      .orderBy("data", "desc")
      .limit(50)
      .get();

    if (snapshot.empty) {
      historicoList.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-message">
                        <i class="fas fa-history"></i>
                        <p>Nenhum ajuste registrado</p>
                    </td>
                </tr>
            `;
      ajustesHistorico = [];
      return;
    }

    // Limpar array
    ajustesHistorico = [];

    // Construir HTML da lista
    let html = "";
    snapshot.forEach((doc) => {
      const ajuste = {
        id: doc.id,
        ...doc.data(),
      };
      ajustesHistorico.push(ajuste);

      // Formatar tipo
      let tipoTexto = "";
      let tipoIcon = "";
      let tipoClass = "";

      switch (ajuste.tipo) {
        case "entrada":
          tipoTexto = "Entrada";
          tipoIcon = "fa-arrow-circle-up";
          tipoClass = "text-success";
          break;
        case "saida":
          tipoTexto = "Saída";
          tipoIcon = "fa-arrow-circle-down";
          tipoClass = "text-danger";
          break;
        case "manutencao":
          tipoTexto = "Manutenção";
          tipoIcon = "fa-wrench";
          tipoClass = "text-warning";
          break;
        case "retorno":
          tipoTexto = "Retorno";
          tipoIcon = "fa-undo";
          tipoClass = "text-info";
          break;
      }

      html += `
                <tr>
                    <td>${formatarData(ajuste.data)}</td>
                    <td>${ajuste.equipamentoNome || ""}</td>
                    <td class="${tipoClass}">
                        <i class="fas ${tipoIcon}"></i>
                        ${tipoTexto}
                    </td>
                    <td>
                        <strong class="${ajuste.tipo === "entrada" || ajuste.tipo === "retorno" ? "text-success" : "text-danger"}">
                            ${ajuste.tipo === "entrada" || ajuste.tipo === "retorno" ? "+" : "-"}${ajuste.quantidade}
                        </strong>
                    </td>
                    <td>${ajuste.motivo || ""}</td>
                    <td>${ajuste.usuario || "Sistema"}</td>
                </tr>
            `;
    });

    historicoList.innerHTML = html;
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    historicoList.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar histórico</p>
                </td>
            </tr>
        `;
  }
}

// Função para visualizar detalhes do equipamento
async function visualizarDetalhes(equipamentoId) {
  try {
    const equipamento = await buscarEquipamentoPorId(equipamentoId);

    if (equipamento) {
      let mensagem = `
                <strong>${equipamento.nomeEquipamento}</strong>
                <hr>
                <p><strong>Categoria:</strong> ${equipamento.categoria || "Não informada"}</p>
                <p><strong>Quantidade Total:</strong> ${equipamento.quantidadeTotal || 0}</p>
                <p><strong>Disponível:</strong> ${equipamento.quantidadeDisponivel || 0}</p>
                <p><strong>Alugado:</strong> ${equipamento.quantidadeAlugada || 0}</p>
                <p><strong>Status:</strong> ${equipamento.status || "desconhecido"}</p>
                <hr>
                <p><strong>Valores:</strong></p>
                <p>• Hora: ${formatarMoeda(equipamento.valorHora || 0)}</p>
                <p>• Dia: ${formatarMoeda(equipamento.valorDia || 0)}</p>
                <p>• Mês: ${formatarMoeda(equipamento.valorMes || 0)}</p>
            `;

      if (equipamento.observacoes) {
        mensagem += `<hr><p><strong>Observações:</strong><br>${equipamento.observacoes}</p>`;
      }

      // Aqui você pode implementar um modal bonito
      alert(mensagem);
    }
  } catch (error) {
    console.error("Erro ao visualizar detalhes:", error);
    mostrarMensagem("Erro", "Não foi possível carregar os detalhes", "error");
  }
}

// Função para limpar formulário de ajuste
function limparAjuste() {
  document.getElementById("ajusteEquipamento").value = "";
  document.getElementById("ajusteTipo").value = "entrada";
  document.getElementById("ajusteQuantidade").value = 1;
  document.getElementById("ajusteMotivo").value = "";
}
