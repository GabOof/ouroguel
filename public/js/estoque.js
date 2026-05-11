let estoque = [];
let ajustesHistorico = [];

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function aguardarFirebaseEstoque() {
  if (window.firebaseReady) {
    await window.firebaseReady;
  }

  if (!window.db) {
    throw new Error("Firestore não inicializado.");
  }

  return window.db;
}

function valorCampoEstoque(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value.trim() : "";
}

function preencherCampoEstoque(id, valor) {
  const campo = document.getElementById(id);

  if (campo) {
    campo.value = valor ?? "";
  }
}

function escaparHTMLEstoque(valor) {
  const div = document.createElement("div");
  div.textContent = String(valor || "");
  return div.innerHTML;
}

function formatarMoedaEstoque(valor) {
  if (typeof formatarMoeda === "function") {
    return formatarMoeda(valor);
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function formatarDataEstoque(data) {
  if (typeof formatarData === "function") {
    return formatarData(data);
  }

  if (!data) {
    return "";
  }

  const dataObj = data.toDate ? data.toDate() : new Date(data);
  return dataObj.toLocaleDateString("pt-BR");
}

function obterStatusEstoque(item) {
  const quantidadeDisponivel = Number(item.quantidadeDisponivel || 0);
  const quantidadeAlugada = Number(item.quantidadeAlugada || 0);
  const quantidadeManutencao = Number(item.quantidadeManutencao || 0);

  if (item.status === "indisponivel") {
    return {
      classe: "status-unavailable",
      texto: "Indisponível",
      icone: "fa-times-circle",
    };
  }

  if (quantidadeDisponivel <= 0 && quantidadeManutencao > 0) {
    return {
      classe: "status-warning",
      texto: "Manutenção",
      icone: "fa-wrench",
    };
  }

  if (quantidadeDisponivel <= 0) {
    return {
      classe: "status-unavailable",
      texto: "Esgotado",
      icone: "fa-times-circle",
    };
  }

  if (quantidadeAlugada > 0 || quantidadeManutencao > 0) {
    return {
      classe: "status-info",
      texto: "Parcial",
      icone: "fa-clock",
    };
  }

  return {
    classe: "status-available",
    texto: "Disponível",
    icone: "fa-check-circle",
  };
}

function calcularStatusOperacional(quantidadeDisponivel, quantidadeManutencao) {
  if (quantidadeDisponivel > 0) {
    return "disponivel";
  }

  if (quantidadeManutencao > 0) {
    return "manutencao";
  }

  return "indisponivel";
}

function configurarEventosEstoque() {
  const filtroCategoria = document.getElementById("filtroCategoria");
  const filtroStatus = document.getElementById("filtroStatus");
  const filtroBusca = document.getElementById("filtroBusca");

  if (filtroCategoria) {
    filtroCategoria.addEventListener("change", filtrarEstoque);
  }

  if (filtroStatus) {
    filtroStatus.addEventListener("change", filtrarEstoque);
  }

  if (filtroBusca) {
    filtroBusca.addEventListener("keyup", filtrarEstoque);
  }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await aguardarFirebaseEstoque();

    configurarEventosEstoque();

    await carregarEstoque();
    await carregarHistoricoAjustes();
    await carregarEquipamentosParaSelect("ajusteEquipamento", false);
  } catch (error) {
    console.error("Erro ao inicializar estoque:", error);

    mostrarMensagem(
      "Erro",
      "Não foi possível inicializar a tela de estoque.",
      "error",
    );
  }
});

// ============================================
// CARREGAMENTO DO ESTOQUE
// ============================================

async function carregarEstoque() {
  const estoqueList = document.getElementById("estoqueList");

  if (!estoqueList) {
    return;
  }

  try {
    const db = await aguardarFirebaseEstoque();

    estoqueList.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando estoque...</p>
        </td>
      </tr>
    `;

    const snapshot = await db
      .collection("equipamentos")
      .orderBy("nomeEquipamento")
      .get();

    estoque = [];

    if (snapshot.empty) {
      estoqueList.innerHTML = `
        <tr>
          <td colspan="8" class="empty-message">
            <i class="fas fa-clipboard-list"></i>
            <p>Nenhum equipamento cadastrado no estoque</p>
          </td>
        </tr>
      `;

      atualizarEstatisticasEstoque();
      return;
    }

    snapshot.forEach((doc) => {
      estoque.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    estoqueList.innerHTML = estoque
      .map((item) => {
        const status = obterStatusEstoque(item);

        const quantidadeTotal = Number(item.quantidadeTotal || 0);
        const quantidadeDisponivel = Number(item.quantidadeDisponivel || 0);
        const quantidadeAlugada = Number(item.quantidadeAlugada || 0);

        const porcentagemDisponivel =
          quantidadeTotal > 0
            ? Math.round((quantidadeDisponivel / quantidadeTotal) * 100)
            : 0;

        const corBarra =
          porcentagemDisponivel >= 50
            ? "#27ae60"
            : porcentagemDisponivel >= 25
              ? "#f39c12"
              : "#e74c3c";

        return `
          <tr>
            <td>
              <strong>${escaparHTMLEstoque(item.nomeEquipamento)}</strong>
              <br><small>${escaparHTMLEstoque(item.categoria)}</small>
            </td>

            <td>${escaparHTMLEstoque(item.categoria)}</td>

            <td>${quantidadeTotal}</td>

            <td>
              <strong style="color: ${corBarra}">
                ${quantidadeDisponivel}
              </strong>

              <div style="width: 100px; height: 8px; background: #eee; border-radius: 4px; margin-top: 5px;">
                <div style="width: ${porcentagemDisponivel}%; height: 100%; background: ${corBarra}; border-radius: 4px;"></div>
              </div>
            </td>

            <td>${quantidadeAlugada}</td>

            <td>
              <span class="status-badge ${status.classe}">
                <i class="fas ${status.icone}"></i>
                ${status.texto}
              </span>
            </td>

            <td>${formatarMoedaEstoque(item.valorDia || 0)}</td>

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
      })
      .join("");

    atualizarEstatisticasEstoque();
  } catch (error) {
    console.error("Erro ao carregar estoque:", error);

    estoqueList.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar estoque</p>
          <small>${escaparHTMLEstoque(error.message)}</small>
        </td>
      </tr>
    `;
  }
}

// ============================================
// FILTROS
// ============================================

function filtrarEstoque() {
  const categoria = valorCampoEstoque("filtroCategoria").toLowerCase();
  const status = valorCampoEstoque("filtroStatus");
  const busca = valorCampoEstoque("filtroBusca").toLowerCase();

  const linhas = document.querySelectorAll("#estoqueList tr");
  let visiveis = 0;

  linhas.forEach((linha) => {
    if (linha.classList.contains("no-results")) {
      linha.remove();
      return;
    }

    if (linha.cells.length < 2) {
      return;
    }

    const textoLinha = linha.textContent.toLowerCase();
    const dadosCategoria = linha.cells[1]?.textContent.toLowerCase() || "";
    const dadosStatus =
      linha.querySelector(".status-badge")?.textContent.toLowerCase() || "";

    let mostrar = true;

    if (categoria && !dadosCategoria.includes(categoria)) {
      mostrar = false;
    }

    if (status) {
      if (status === "disponivel" && !dadosStatus.includes("disponível")) {
        mostrar = false;
      }

      if (status === "alugado" && !dadosStatus.includes("parcial")) {
        mostrar = false;
      }

      if (
        status === "indisponivel" &&
        !dadosStatus.includes("indisponível") &&
        !dadosStatus.includes("esgotado")
      ) {
        mostrar = false;
      }

      if (status === "manutencao" && !dadosStatus.includes("manutenção")) {
        mostrar = false;
      }
    }

    if (busca && !textoLinha.includes(busca)) {
      mostrar = false;
    }

    linha.style.display = mostrar ? "" : "none";

    if (mostrar) {
      visiveis++;
    }
  });

  if (visiveis === 0) {
    const tbody = document.getElementById("estoqueList");

    if (tbody && !tbody.querySelector(".no-results")) {
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
  }
}

function limparFiltros() {
  preencherCampoEstoque("filtroCategoria", "");
  preencherCampoEstoque("filtroStatus", "");
  preencherCampoEstoque("filtroBusca", "");

  const linhas = document.querySelectorAll("#estoqueList tr");

  linhas.forEach((linha) => {
    linha.style.display = "";
  });

  const noResults = document.querySelector(".no-results");

  if (noResults) {
    noResults.remove();
  }
}

// ============================================
// ESTATÍSTICAS
// ============================================

function atualizarEstatisticasEstoque() {
  let totalItens = 0;
  let disponiveis = 0;
  let alugados = 0;
  let indisponiveis = 0;

  estoque.forEach((item) => {
    const quantidadeTotal = Number(item.quantidadeTotal || 0);
    const quantidadeDisponivel = Number(item.quantidadeDisponivel || 0);
    const quantidadeAlugada = Number(item.quantidadeAlugada || 0);
    const quantidadeManutencao = Number(item.quantidadeManutencao || 0);

    totalItens += quantidadeTotal;
    disponiveis += quantidadeDisponivel;
    alugados += quantidadeAlugada;

    const foraDeUso = Math.max(
      0,
      quantidadeTotal - quantidadeDisponivel - quantidadeAlugada,
    );

    indisponiveis += Math.max(foraDeUso, quantidadeManutencao);
  });

  const totalItensEl = document.getElementById("totalItens");
  const disponiveisEl = document.getElementById("disponiveis");
  const alugadosEl = document.getElementById("alugados");
  const indisponiveisEl = document.getElementById("indisponiveis");

  if (totalItensEl) totalItensEl.textContent = totalItens;
  if (disponiveisEl) disponiveisEl.textContent = disponiveis;
  if (alugadosEl) alugadosEl.textContent = alugados;
  if (indisponiveisEl) indisponiveisEl.textContent = indisponiveis;
}

// ============================================
// AJUSTE DE ESTOQUE
// ============================================

function ajustarEstoqueRapido(equipamentoId) {
  const equipamento = estoque.find((item) => item.id === equipamentoId);

  if (!equipamento) {
    mostrarMensagem("Erro", "Equipamento não encontrado na lista.", "error");
    return;
  }

  preencherCampoEstoque("ajusteEquipamento", equipamentoId);
  preencherCampoEstoque("ajusteQuantidade", 1);
  preencherCampoEstoque("ajusteMotivo", "Ajuste manual");

  const ajusteQuantidade = document.getElementById("ajusteQuantidade");

  if (ajusteQuantidade) {
    ajusteQuantidade.focus();
  }

  const formSections = document.querySelectorAll(".form-section");
  const ultimaFormSection = formSections[formSections.length - 1];

  if (ultimaFormSection) {
    ultimaFormSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  mostrarMensagem(
    "Informação",
    `Pronto para ajustar o estoque de: ${equipamento.nomeEquipamento}`,
    "info",
  );
}

async function realizarAjuste() {
  const equipamentoId = valorCampoEstoque("ajusteEquipamento");
  const tipo = valorCampoEstoque("ajusteTipo");
  const quantidade = parseInt(valorCampoEstoque("ajusteQuantidade"), 10) || 0;
  const motivo = valorCampoEstoque("ajusteMotivo");

  if (!equipamentoId) {
    mostrarMensagem("Erro", "Selecione um equipamento.", "error");
    return;
  }

  if (!["entrada", "saida", "manutencao", "retorno"].includes(tipo)) {
    mostrarMensagem("Erro", "Tipo de ajuste inválido.", "error");
    return;
  }

  if (quantidade <= 0) {
    mostrarMensagem("Erro", "A quantidade deve ser maior que zero.", "error");
    return;
  }

  if (!motivo) {
    mostrarMensagem("Erro", "Informe o motivo do ajuste.", "error");
    return;
  }

  try {
    const db = await aguardarFirebaseEstoque();

    const equipamentoRef = db.collection("equipamentos").doc(equipamentoId);
    const historicoRef = db.collection("historico_ajustes").doc();

    await db.runTransaction(async function (transaction) {
      const equipamentoDoc = await transaction.get(equipamentoRef);

      if (!equipamentoDoc.exists) {
        throw new Error("Equipamento não encontrado.");
      }

      const equipamento = equipamentoDoc.data();

      let quantidadeTotal = Number(equipamento.quantidadeTotal || 0);
      let quantidadeDisponivel = Number(equipamento.quantidadeDisponivel || 0);
      let quantidadeAlugada = Number(equipamento.quantidadeAlugada || 0);
      let quantidadeManutencao = Number(equipamento.quantidadeManutencao || 0);

      switch (tipo) {
        case "entrada":
          quantidadeTotal += quantidade;
          quantidadeDisponivel += quantidade;
          break;

        case "saida":
          if (quantidade > quantidadeDisponivel) {
            throw new Error("Quantidade insuficiente disponível para saída.");
          }

          quantidadeTotal -= quantidade;
          quantidadeDisponivel -= quantidade;
          break;

        case "manutencao":
          if (quantidade > quantidadeDisponivel) {
            throw new Error(
              "Quantidade insuficiente disponível para enviar à manutenção.",
            );
          }

          quantidadeDisponivel -= quantidade;
          quantidadeManutencao += quantidade;
          break;

        case "retorno":
          if (quantidade > quantidadeManutencao) {
            throw new Error(
              `Quantidade em manutenção insuficiente. Em manutenção: ${quantidadeManutencao}.`,
            );
          }

          quantidadeManutencao -= quantidade;
          quantidadeDisponivel += quantidade;
          break;
      }

      const statusAtualizado = calcularStatusOperacional(
        quantidadeDisponivel,
        quantidadeManutencao,
      );

      transaction.update(equipamentoRef, {
        quantidadeTotal,
        quantidadeDisponivel,
        quantidadeAlugada,
        quantidadeManutencao,
        status: statusAtualizado,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      transaction.set(historicoRef, {
        equipamentoId,
        equipamentoNome: equipamento.nomeEquipamento || "",
        tipo,
        quantidade,
        motivo,
        data: new Date().toISOString(),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        usuarioId: window.auth?.currentUser?.uid || null,
        usuario:
          localStorage.getItem("userName") ||
          window.auth?.currentUser?.email ||
          "Sistema",
      });
    });

    mostrarMensagem("Sucesso", "Ajuste realizado com sucesso!");

    limparAjuste();

    await carregarEstoque();
    await carregarHistoricoAjustes();
    await carregarEquipamentosParaSelect("ajusteEquipamento", false);
  } catch (error) {
    console.error("Erro ao realizar ajuste:", error);

    mostrarMensagem(
      "Erro",
      "Erro ao realizar ajuste: " + error.message,
      "error",
    );
  }
}

// ============================================
// HISTÓRICO
// ============================================

async function carregarHistoricoAjustes() {
  const historicoList = document.getElementById("historicoList");

  if (!historicoList) {
    return;
  }

  try {
    const db = await aguardarFirebaseEstoque();

    historicoList.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando histórico...</p>
        </td>
      </tr>
    `;

    const snapshot = await db
      .collection("historico_ajustes")
      .orderBy("data", "desc")
      .limit(50)
      .get();

    ajustesHistorico = [];

    if (snapshot.empty) {
      historicoList.innerHTML = `
        <tr>
          <td colspan="6" class="empty-message">
            <i class="fas fa-history"></i>
            <p>Nenhum ajuste registrado</p>
          </td>
        </tr>
      `;
      return;
    }

    snapshot.forEach((doc) => {
      ajustesHistorico.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    historicoList.innerHTML = ajustesHistorico
      .map((ajuste) => {
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

          default:
            tipoTexto = "Ajuste";
            tipoIcon = "fa-edit";
            tipoClass = "";
        }

        const sinal =
          ajuste.tipo === "entrada" || ajuste.tipo === "retorno" ? "+" : "-";

        return `
          <tr>
            <td>${formatarDataEstoque(ajuste.data)}</td>

            <td>${escaparHTMLEstoque(ajuste.equipamentoNome)}</td>

            <td class="${tipoClass}">
              <i class="fas ${tipoIcon}"></i>
              ${tipoTexto}
            </td>

            <td>
              <strong class="${
                ajuste.tipo === "entrada" || ajuste.tipo === "retorno"
                  ? "text-success"
                  : "text-danger"
              }">
                ${sinal}${ajuste.quantidade}
              </strong>
            </td>

            <td>${escaparHTMLEstoque(ajuste.motivo)}</td>

            <td>${escaparHTMLEstoque(ajuste.usuario || "Sistema")}</td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);

    historicoList.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #e74c3c;">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar histórico</p>
          <small>${escaparHTMLEstoque(error.message)}</small>
        </td>
      </tr>
    `;
  }
}

// ============================================
// DETALHES E LIMPEZA
// ============================================

async function visualizarDetalhes(equipamentoId) {
  try {
    const equipamento = await buscarEquipamentoPorId(equipamentoId);

    if (!equipamento) {
      mostrarMensagem("Erro", "Equipamento não encontrado.", "error");
      return;
    }

    const mensagem =
      `Equipamento: ${equipamento.nomeEquipamento || ""}\n\n` +
      `Categoria: ${equipamento.categoria || "Não informada"}\n` +
      `Quantidade Total: ${equipamento.quantidadeTotal || 0}\n` +
      `Disponível: ${equipamento.quantidadeDisponivel || 0}\n` +
      `Alugado: ${equipamento.quantidadeAlugada || 0}\n` +
      `Manutenção: ${equipamento.quantidadeManutencao || 0}\n` +
      `Status: ${equipamento.status || "desconhecido"}\n\n` +
      `Valores:\n` +
      `Hora: ${formatarMoedaEstoque(equipamento.valorHora || 0)}\n` +
      `Dia: ${formatarMoedaEstoque(equipamento.valorDia || 0)}\n` +
      `Mês: ${formatarMoedaEstoque(equipamento.valorMes || 0)}\n\n` +
      `Observações:\n${equipamento.observacoes || "Nenhuma observação."}`;

    alert(mensagem);
  } catch (error) {
    console.error("Erro ao visualizar detalhes:", error);

    mostrarMensagem("Erro", "Não foi possível carregar os detalhes.", "error");
  }
}

function limparAjuste() {
  preencherCampoEstoque("ajusteEquipamento", "");
  preencherCampoEstoque("ajusteTipo", "entrada");
  preencherCampoEstoque("ajusteQuantidade", 1);
  preencherCampoEstoque("ajusteMotivo", "");
}
