let equipamentos = [];
let equipamentoEditando = null;

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function aguardarFirebaseEquipamentos() {
  if (window.firebaseReady) {
    await window.firebaseReady;
  }

  if (!window.db) {
    throw new Error("Firestore não inicializado.");
  }

  return window.db;
}

function valorCampo(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value.trim() : "";
}

function preencherCampo(id, valor) {
  const campo = document.getElementById(id);

  if (campo) {
    campo.value = valor ?? "";
  }
}

function escaparHTMLLocal(valor) {
  const div = document.createElement("div");
  div.textContent = String(valor || "");
  return div.innerHTML;
}

function parseMoedaBR(valor) {
  if (typeof valor === "number") {
    return valor;
  }

  const texto = String(valor || "")
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(texto);

  return Number.isFinite(numero) ? numero : 0;
}

function formatarMoedaInput(valor) {
  return Number(valor || 0)
    .toFixed(2)
    .replace(".", ",");
}

function formatarMoedaTabela(valor) {
  if (typeof formatarMoeda === "function") {
    return formatarMoeda(valor);
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function obterStatusSelecionado() {
  const statusSelecionado = document.querySelector(
    'input[name="status"]:checked',
  );

  return statusSelecionado ? statusSelecionado.value : "disponivel";
}

function marcarStatus(status) {
  const radio = document.querySelector(
    `input[name="status"][value="${status || "disponivel"}"]`,
  );

  if (radio) {
    radio.checked = true;
  }
}

function coletarDadosEquipamento() {
  return {
    nomeEquipamento: valorCampo("nomeEquipamento"),
    nomeBusca: valorCampo("nomeEquipamento").toLowerCase(),
    categoria: valorCampo("categoria"),
    quantidadeTotal: parseInt(valorCampo("quantidadeTotal"), 10) || 0,
    valorHora: parseMoedaBR(valorCampo("valorHora")),
    valorDia: parseMoedaBR(valorCampo("valorDia")),
    valorMes: parseMoedaBR(valorCampo("valorMes")),
    status: obterStatusSelecionado(),
    observacoes: valorCampo("observacoes"),
  };
}

function validarEquipamento(dados) {
  if (!dados.nomeEquipamento) {
    return "Nome do equipamento é obrigatório.";
  }

  if (!dados.categoria) {
    return "Categoria é obrigatória.";
  }

  if (dados.quantidadeTotal <= 0) {
    return "Quantidade total deve ser maior que zero.";
  }

  if (dados.valorHora < 0) {
    return "Valor por hora não pode ser negativo.";
  }

  if (dados.valorDia <= 0) {
    return "Valor por dia deve ser maior que zero.";
  }

  if (dados.valorMes < 0) {
    return "Valor por mês não pode ser negativo.";
  }

  if (!["disponivel", "indisponivel", "manutencao"].includes(dados.status)) {
    return "Status inválido.";
  }

  return null;
}

function obterStatusVisual(equipamento) {
  if (equipamento.status === "indisponivel") {
    return {
      classe: "status-unavailable",
      icone: "fa-times-circle",
      texto: "Indisponível",
    };
  }

  if (equipamento.status === "manutencao") {
    return {
      classe: "status-warning",
      icone: "fa-wrench",
      texto: "Manutenção",
    };
  }

  if ((equipamento.quantidadeDisponivel || 0) <= 0) {
    return {
      classe: "status-unavailable",
      icone: "fa-times-circle",
      texto: "Esgotado",
    };
  }

  return {
    classe: "status-available",
    icone: "fa-check-circle",
    texto: "Disponível",
  };
}

function configurarFormularioEquipamento() {
  const form = document.getElementById("equipamentoForm");

  if (form) {
    form.addEventListener("submit", salvarEquipamento);
  }

  const quantidadeTotal = document.getElementById("quantidadeTotal");

  if (quantidadeTotal) {
    quantidadeTotal.addEventListener("change", function () {
      if (Number(this.value) < 1) {
        this.value = 1;
      }
    });
  }

  const camposMoeda = document.querySelectorAll(".money-input");

  camposMoeda.forEach((campo) => {
    campo.addEventListener("blur", function () {
      this.value = formatarMoedaInput(parseMoedaBR(this.value));
    });
  });

  marcarStatus("disponivel");
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await aguardarFirebaseEquipamentos();

    configurarFormularioEquipamento();

    await carregarEquipamentos();
    await atualizarEstatisticas();
  } catch (error) {
    console.error("Erro ao inicializar equipamentos:", error);
    mostrarMensagem(
      "Erro",
      "Não foi possível inicializar a tela de equipamentos.",
      "error",
    );
  }
});

// ============================================
// CRUD
// ============================================

async function salvarEquipamento(event) {
  event.preventDefault();

  const dadosEquipamento = coletarDadosEquipamento();
  const erroValidacao = validarEquipamento(dadosEquipamento);

  if (erroValidacao) {
    mostrarMensagem("Erro", erroValidacao, "error");
    return;
  }

  try {
    const db = await aguardarFirebaseEquipamentos();

    if (equipamentoEditando) {
      const equipamentoRef = db
        .collection("equipamentos")
        .doc(equipamentoEditando);

      const equipamentoAtual = await equipamentoRef.get();

      if (!equipamentoAtual.exists) {
        mostrarMensagem("Erro", "Equipamento não encontrado.", "error");
        return;
      }

      const dadosAtuais = equipamentoAtual.data();
      const quantidadeAlugada = Number(dadosAtuais.quantidadeAlugada || 0);

      if (dadosEquipamento.quantidadeTotal < quantidadeAlugada) {
        mostrarMensagem(
          "Erro",
          `Não é possível definir quantidade total menor que a quantidade alugada atual (${quantidadeAlugada}).`,
          "error",
        );
        return;
      }

      await equipamentoRef.update({
        ...dadosEquipamento,
        quantidadeAlugada,
        quantidadeDisponivel:
          dadosEquipamento.quantidadeTotal - quantidadeAlugada,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      mostrarMensagem("Sucesso", "Equipamento atualizado com sucesso!");
    } else {
      await db.collection("equipamentos").add({
        ...dadosEquipamento,
        quantidadeDisponivel: dadosEquipamento.quantidadeTotal,
        quantidadeAlugada: 0,
        ativo: true,
        dataCadastro: new Date().toISOString(),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      mostrarMensagem("Sucesso", "Equipamento cadastrado com sucesso!");
    }

    limparFormularioEquipamento();

    await carregarEquipamentos();
    await atualizarEstatisticas();
  } catch (error) {
    console.error("Erro ao salvar equipamento:", error);

    mostrarMensagem(
      "Erro",
      "Erro ao salvar equipamento: " + error.message,
      "error",
    );
  }
}

async function carregarEquipamentos() {
  const equipamentosList = document.getElementById("equipamentosList");

  if (!equipamentosList) {
    return;
  }

  try {
    const db = await aguardarFirebaseEquipamentos();

    equipamentosList.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando equipamentos...</p>
        </td>
      </tr>
    `;

    const snapshot = await db
      .collection("equipamentos")
      .orderBy("nomeEquipamento")
      .get();

    equipamentos = [];

    if (snapshot.empty) {
      equipamentosList.innerHTML = `
        <tr>
          <td colspan="6" class="empty-message">
            <i class="fas fa-box"></i>
            <p>Nenhum equipamento cadastrado ainda</p>
          </td>
        </tr>
      `;
      return;
    }

    snapshot.forEach((doc) => {
      equipamentos.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    equipamentosList.innerHTML = equipamentos
      .map((equipamento) => {
        const status = obterStatusVisual(equipamento);

        const nome = escaparHTMLLocal(equipamento.nomeEquipamento);
        const categoria = escaparHTMLLocal(equipamento.categoria);
        const observacoes = escaparHTMLLocal(equipamento.observacoes || "");
        const observacoesResumo =
          observacoes.length > 50
            ? observacoes.substring(0, 50) + "..."
            : observacoes;

        return `
          <tr>
            <td>
              <strong>${nome}</strong>
              ${
                observacoesResumo
                  ? `<br><small>${observacoesResumo}</small>`
                  : ""
              }
            </td>

            <td>${categoria}</td>

            <td>
              <strong>${equipamento.quantidadeTotal || 0}</strong>
              <small style="display: block; color: #666;">
                Disp: ${equipamento.quantidadeDisponivel || 0} |
                Alug: ${equipamento.quantidadeAlugada || 0}
              </small>
            </td>

            <td>${formatarMoedaTabela(equipamento.valorDia || 0)}</td>

            <td>
              <span class="status-badge ${status.classe}">
                <i class="fas ${status.icone}"></i>
                ${status.texto}
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
      })
      .join("");
  } catch (error) {
    console.error("Erro ao carregar equipamentos:", error);

    equipamentosList.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #e74c3c;">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar equipamentos</p>
          <small>${escaparHTMLLocal(error.message)}</small>
        </td>
      </tr>
    `;
  }
}

function buscarEquipamentos() {
  const termo = valorCampo("searchEquipamentos").toLowerCase();
  const linhas = document.querySelectorAll("#equipamentosList tr");

  linhas.forEach((linha) => {
    const textoLinha = linha.textContent.toLowerCase();
    linha.style.display = textoLinha.includes(termo) ? "" : "none";
  });
}

async function editarEquipamento(equipamentoId) {
  try {
    const db = await aguardarFirebaseEquipamentos();

    const doc = await db.collection("equipamentos").doc(equipamentoId).get();

    if (!doc.exists) {
      mostrarMensagem("Erro", "Equipamento não encontrado.", "error");
      return;
    }

    const equipamento = doc.data();
    equipamentoEditando = equipamentoId;

    preencherCampo("nomeEquipamento", equipamento.nomeEquipamento);
    preencherCampo("categoria", equipamento.categoria);
    preencherCampo("quantidadeTotal", equipamento.quantidadeTotal || 1);
    preencherCampo("valorHora", formatarMoedaInput(equipamento.valorHora || 0));
    preencherCampo("valorDia", formatarMoedaInput(equipamento.valorDia || 0));
    preencherCampo("valorMes", formatarMoedaInput(equipamento.valorMes || 0));
    preencherCampo("observacoes", equipamento.observacoes);

    marcarStatus(equipamento.status || "disponivel");

    const botaoSalvar = document.querySelector(
      '#equipamentoForm button[type="submit"]',
    );

    if (botaoSalvar) {
      botaoSalvar.innerHTML =
        '<i class="fas fa-sync-alt"></i> Atualizar Equipamento';
    }

    const formSection = document.querySelector(".form-section");

    if (formSection) {
      formSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    mostrarMensagem(
      "Informação",
      "Editando equipamento. Modifique os dados e clique em Atualizar.",
      "info",
    );
  } catch (error) {
    console.error("Erro ao carregar equipamento para edição:", error);

    mostrarMensagem(
      "Erro",
      "Não foi possível carregar o equipamento para edição.",
      "error",
    );
  }
}

async function excluirEquipamento(equipamentoId) {
  const confirmar = confirm(
    "Tem certeza que deseja excluir este equipamento?\n\nEsta ação não pode ser desfeita.",
  );

  if (!confirmar) {
    return;
  }

  try {
    const db = await aguardarFirebaseEquipamentos();

    const alugueisSnapshot = await db
      .collection("alugueis")
      .where("equipamentosIds", "array-contains", equipamentoId)
      .where("status", "==", "ativo")
      .get();

    if (!alugueisSnapshot.empty) {
      mostrarMensagem(
        "Atenção",
        "Não é possível excluir este equipamento, pois existem aluguéis ativos relacionados a ele.",
        "warning",
      );
      return;
    }

    await db.collection("equipamentos").doc(equipamentoId).delete();

    mostrarMensagem("Sucesso", "Equipamento excluído com sucesso!");

    await carregarEquipamentos();
    await atualizarEstatisticas();
  } catch (error) {
    console.error("Erro ao excluir equipamento:", error);

    mostrarMensagem(
      "Erro",
      "Erro ao excluir equipamento: " + error.message,
      "error",
    );
  }
}

function selecionarEquipamentoParaAluguel(equipamentoId) {
  localStorage.setItem("equipamentoSelecionado", equipamentoId);
  window.location.href = "aluguel.html";
}

async function atualizarEstatisticas() {
  try {
    const db = await aguardarFirebaseEquipamentos();

    const snapshot = await db.collection("equipamentos").get();

    let totalEquipamentos = 0;
    let totalDisponivel = 0;
    let totalIndisponivel = 0;
    let totalManutencao = 0;

    snapshot.forEach((doc) => {
      const equipamento = doc.data();

      const quantidadeTotal = Number(equipamento.quantidadeTotal || 0);
      const quantidadeDisponivel = Number(
        equipamento.quantidadeDisponivel || 0,
      );

      totalEquipamentos += quantidadeTotal;

      if (equipamento.status === "disponivel") {
        totalDisponivel += quantidadeDisponivel;
      }

      if (equipamento.status === "indisponivel") {
        totalIndisponivel += quantidadeTotal;
      }

      if (equipamento.status === "manutencao") {
        totalManutencao += quantidadeTotal;
      }
    });

    const totalEquipamentosEl = document.getElementById("totalEquipamentos");
    const totalDisponivelEl = document.getElementById("totalDisponivel");
    const totalIndisponivelEl = document.getElementById("totalIndisponivel");
    const totalManutencaoEl = document.getElementById("totalManutencao");

    if (totalEquipamentosEl) {
      totalEquipamentosEl.textContent = totalEquipamentos;
    }

    if (totalDisponivelEl) {
      totalDisponivelEl.textContent = totalDisponivel;
    }

    if (totalIndisponivelEl) {
      totalIndisponivelEl.textContent = totalIndisponivel;
    }

    if (totalManutencaoEl) {
      totalManutencaoEl.textContent = totalManutencao;
    }
  } catch (error) {
    console.error("Erro ao atualizar estatísticas:", error);
  }
}

function limparFormularioEquipamento() {
  const form = document.getElementById("equipamentoForm");

  if (form) {
    form.reset();
  }

  equipamentoEditando = null;

  const botaoSalvar = document.querySelector(
    '#equipamentoForm button[type="submit"]',
  );

  if (botaoSalvar) {
    botaoSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Equipamento';
  }

  preencherCampo("quantidadeTotal", 1);
  preencherCampo("valorHora", "0,00");
  preencherCampo("valorDia", "0,00");
  preencherCampo("valorMes", "0,00");
  preencherCampo("observacoes", "");

  marcarStatus("disponivel");

  const nomeEquipamento = document.getElementById("nomeEquipamento");

  if (nomeEquipamento) {
    nomeEquipamento.focus();
  }
}
