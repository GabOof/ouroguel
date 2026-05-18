let equipamentos = [];
let equipamentoEditando = null;

// ============================================
// FUNÇÕES AUXILIARES DE INTERFACE
// ============================================

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

function formatarValorTabelaEquipamento(valor) {
  const numero = Number(valor || 0);

  if (!Number.isFinite(numero) || numero <= 0) {
    return "";
  }

  return formatarMoedaTabela(numero);
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

  if (dados.valorDia < 0) {
    return "Valor por dia não pode ser negativo.";
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
  const quantidadeDisponivel = Number(equipamento.quantidadeDisponivel || 0);

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

  if (quantidadeDisponivel <= 0) {
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

async function aguardarDependenciasEquipamentos() {
  if (window.firebaseReady) {
    await window.firebaseReady;
  }

  if (!window.equipamentosService) {
    throw new Error("equipamentosService não foi carregado.");
  }
}

// ============================================
// CONFIGURAÇÃO DA TELA
// ============================================

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

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await aguardarDependenciasEquipamentos();

    configurarFormularioEquipamento();

    await carregarEquipamentos();
    await atualizarEstatisticas();
  } catch (error) {
    console.error("Erro ao inicializar equipamentos:", error);

    mostrarMensagem(
      "Erro",
      "Não foi possível inicializar a tela de equipamentos: " + error.message,
      "error",
    );
  }
});

// ============================================
// CRUD DE INTERFACE
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
    if (equipamentoEditando) {
      await equipamentosService.atualizar(
        equipamentoEditando,
        dadosEquipamento,
      );
      mostrarMensagem("Sucesso", "Equipamento atualizado com sucesso!");
    } else {
      await equipamentosService.criar(dadosEquipamento);
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
    equipamentosList.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando equipamentos...</p>
        </td>
      </tr>
    `;

    equipamentos = await equipamentosService.listar();

    const equipamentosComPreco = equipamentos.filter((equipamento) => {
      const valorHora = Number(equipamento.valorHora || 0);
      const valorDia = Number(equipamento.valorDia || 0);
      const valorMes = Number(equipamento.valorMes || 0);

      return valorHora > 0 || valorDia > 0 || valorMes > 0;
    });

    if (!equipamentosComPreco.length) {
      equipamentosList.innerHTML = `
    <tr>
      <td colspan="5" class="empty-message">
        <i class="fas fa-box"></i>
        <p>Nenhum equipamento com preço cadastrado ainda</p>
      </td>
    </tr>
  `;
      return;
    }

    equipamentosList.innerHTML = equipamentosComPreco
      .map((equipamento) => {
        const status = obterStatusVisual(equipamento);

        const nome = escaparHTMLLocal(equipamento.nomeEquipamento);
        const observacoes = escaparHTMLLocal(equipamento.observacoes || "");

        return `
          <tr>
            <td class="col-nome-observacoes">
              <strong>${nome}</strong>
              ${
                observacoes
                  ? `<br><small class="texto-observacoes">${observacoes}</small>`
                  : ""
              }
            </td>

            <td class="col-quantidade">
              <strong>${equipamento.quantidadeTotal || 0}</strong>
              <small style="display: block; color: #666;">
                Disp: ${equipamento.quantidadeDisponivel || 0} |
                Alug: ${equipamento.quantidadeAlugada || 0}
              </small>
            </td>

            <td class="col-valor">${formatarValorTabelaEquipamento(equipamento.valorDia)}</td>

            <td class="col-status">
              <span class="status-badge ${status.classe}">
                <i class="fas ${status.icone}"></i>
                ${status.texto}
              </span>
            </td>

            <td class="col-acoes">
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
        <td colspan="5" style="text-align: center; padding: 40px; color: #e74c3c;">
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
    const equipamento = await equipamentosService.obterPorId(equipamentoId);

    if (!equipamento) {
      mostrarMensagem("Erro", "Equipamento não encontrado.", "error");
      return;
    }

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
    await equipamentosService.excluir(equipamentoId);

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

// ============================================
// ESTATÍSTICAS
// ============================================

async function atualizarEstatisticas() {
  try {
    const estatisticas = await equipamentosService.obterEstatisticas();

    const totalEquipamentosEl = document.getElementById("totalEquipamentos");
    const totalDisponivelEl = document.getElementById("totalDisponivel");
    const totalIndisponivelEl = document.getElementById("totalIndisponivel");
    const totalManutencaoEl = document.getElementById("totalManutencao");

    if (totalEquipamentosEl) {
      totalEquipamentosEl.textContent = estatisticas.totalEquipamentos;
    }

    if (totalDisponivelEl) {
      totalDisponivelEl.textContent = estatisticas.totalDisponivel;
    }

    if (totalIndisponivelEl) {
      totalIndisponivelEl.textContent = estatisticas.totalIndisponivel;
    }

    if (totalManutencaoEl) {
      totalManutencaoEl.textContent = estatisticas.totalManutencao;
    }
  } catch (error) {
    console.error("Erro ao atualizar estatísticas:", error);
  }
}

// ============================================
// LIMPEZA
// ============================================

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
