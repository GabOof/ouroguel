let alugueis = [];
let equipamentosSelecionados = [];
let clienteSelecionado = null;

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

function escaparHTMLAluguel(valor) {
  const div = document.createElement("div");
  div.textContent = String(valor || "");
  return div.innerHTML;
}

function formatarMoedaAluguel(valor) {
  if (typeof formatarMoeda === "function") {
    return formatarMoeda(valor);
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function dataHojeISO() {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().split("T")[0];
}

function calcularDataDevolucaoLocal(dataInicio, periodo, duracao) {
  const [ano, mes, dia] = dataInicio.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);

  if (periodo === "hora") {
    data.setHours(data.getHours() + duracao);
  }

  if (periodo === "dia") {
    data.setDate(data.getDate() + duracao);
  }

  if (periodo === "mes") {
    data.setMonth(data.getMonth() + duracao);
  }

  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().split("T")[0];
}

function calcularDuracaoReal(dataInicio, dataFim, periodo) {
  const criarData = (valor) => {
    const [ano, mes, dia] = String(valor || "")
      .split("-")
      .map(Number);
    return new Date(ano, mes - 1, dia);
  };

  const inicio = criarData(dataInicio);
  const fim = criarData(dataFim);
  const diffMs = Math.max(0, fim.getTime() - inicio.getTime());

  if (periodo === "hora") {
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  }

  if (periodo === "mes") {
    let meses =
      (fim.getFullYear() - inicio.getFullYear()) * 12 +
      (fim.getMonth() - inicio.getMonth());

    if (fim.getDate() > inicio.getDate()) meses += 1;
    return Math.max(1, meses);
  }

  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function obterTextoPeriodo(periodo) {
  if (periodo === "hora") return "Por Hora";
  if (periodo === "dia") return "Por Dia";
  if (periodo === "mes") return "Por Mês";
  return "";
}

function obterValorPorPeriodoDoObjeto(equipamento, periodo) {
  if (periodo === "hora") {
    return Number(equipamento.valorHora || 0);
  }

  if (periodo === "dia") {
    return Number(equipamento.valorDia || 0);
  }

  if (periodo === "mes") {
    return Number(equipamento.valorMes || 0);
  }

  return 0;
}

function getValorPorPeriodo(equipamento) {
  const periodo = valorCampo("periodo");
  return obterValorPorPeriodoDoObjeto(equipamento, periodo);
}

function obterResumoNumerico() {
  const duracao = parseInt(valorCampo("duracao"), 10) || 1;

  let subtotal = 0;

  equipamentosSelecionados.forEach((item) => {
    const quantidadeCobrada = Number(
      item.quantidadeCobrada || item.quantidade || 1,
    );
    subtotal += getValorPorPeriodo(item) * quantidadeCobrada;
  });

  return {
    subtotal,
    valorTotal: subtotal * duracao,
  };
}

function validarFormularioAluguel() {
  const clienteId = valorCampo("clienteSelect");
  const dataInicio = valorCampo("dataInicio");
  const periodo = valorCampo("periodo");
  const duracao = parseInt(valorCampo("duracao"), 10) || 0;

  if (!clienteId) {
    return "Selecione um cliente.";
  }

  if (!dataInicio) {
    return "Informe a data de início.";
  }

  if (!periodo) {
    return "Selecione o período do aluguel.";
  }

  if (duracao <= 0) {
    return "A duração deve ser maior que zero.";
  }

  if (equipamentosSelecionados.length === 0) {
    return "Adicione pelo menos um equipamento.";
  }

  return null;
}

async function aguardarDependenciasAluguel() {
  if (window.firebaseReady) {
    await window.firebaseReady;
  }

  if (!window.AluguelService) {
    throw new Error("AluguelService não foi carregado.");
  }
}

function parseNumeroBR(valor) {
  if (typeof valor === "number") return valor;

  const texto = String(valor || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function obterRotuloUnidadeCobranca(item) {
  if (item.rotuloUnidadeCobranca) return item.rotuloUnidadeCobranca;

  const unidade = item.unidadeCobranca || "unidade";

  const rotulos = {
    unidade: "unid.",
    metro: "m",
    metro2: "m²",
    duzia: "dúzia",
    conjunto: "conj.",
    jogo: "jogo",
    quilo: "kg",
    dosagem: "200 ml",
  };

  return rotulos[unidade] || "unid.";
}

function quantidadeCobradaPadrao(item, quantidadeEstoque) {
  const unidade = item.unidadeCobranca || "unidade";

  if (["metro", "metro2", "quilo", "dosagem", "duzia"].includes(unidade)) {
    return 1;
  }

  return quantidadeEstoque || 1;
}

function calcularDuracaoRealLocal(dataInicio, dataFim, periodo) {
  const criarData = (valor) => {
    const [ano, mes, dia] = String(valor || "")
      .split("-")
      .map(Number);
    return new Date(ano, mes - 1, dia);
  };

  const inicio = criarData(dataInicio);
  const fim = criarData(dataFim);
  const diffMs = Math.max(0, fim.getTime() - inicio.getTime());

  if (periodo === "hora") {
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  }

  if (periodo === "mes") {
    let meses =
      (fim.getFullYear() - inicio.getFullYear()) * 12 +
      (fim.getMonth() - inicio.getMonth());

    if (fim.getDate() > inicio.getDate()) meses += 1;
    return Math.max(1, meses);
  }

  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ============================================
// CONFIGURAÇÃO DA TELA
// ============================================

function configurarFormularioAluguel() {
  const form = document.getElementById("aluguelForm");

  if (form) {
    form.addEventListener("submit", registrarAluguel);
  }

  const dataInicio = document.getElementById("dataInicio");

  if (dataInicio) {
    dataInicio.value = dataHojeISO();
    dataInicio.min = dataHojeISO();
  }

  const duracao = document.getElementById("duracao");

  if (duracao && !duracao.value) {
    duracao.value = 1;
  }

  const periodo = document.getElementById("periodo");

  if (periodo) {
    periodo.addEventListener("change", calcularValor);
  }

  if (duracao) {
    duracao.addEventListener("input", calcularValor);
  }

  const btnImprimir = document.getElementById("btnImprimir");

  if (btnImprimir) {
    btnImprimir.disabled = true;
    btnImprimir.style.display = "none";
    btnImprimir.addEventListener("click", imprimirContrato);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await aguardarDependenciasAluguel();

    configurarFormularioAluguel();

    await carregarClientesParaSelect("clienteSelect");
    await carregarEquipamentosParaSelect("equipamentoSelect");
    await carregarAlugueis();

    await aplicarPreSelecoes();
  } catch (error) {
    console.error("Erro ao inicializar tela de aluguel:", error);

    mostrarMensagem(
      "Erro",
      "Não foi possível inicializar a tela de aluguéis: " + error.message,
      "error",
    );
  }
});

async function aplicarPreSelecoes() {
  const clienteId = localStorage.getItem("clienteSelecionado");

  if (clienteId) {
    const clienteSelect = document.getElementById("clienteSelect");

    if (clienteSelect) {
      clienteSelect.value = clienteId;
      await atualizarInfoCliente();
    }

    localStorage.removeItem("clienteSelecionado");
  }

  const equipamentoId = localStorage.getItem("equipamentoSelecionado");

  if (equipamentoId) {
    const equipamentoSelect = document.getElementById("equipamentoSelect");

    if (equipamentoSelect) {
      equipamentoSelect.value = equipamentoId;
      await atualizarInfoEquipamento();
    }

    localStorage.removeItem("equipamentoSelecionado");
  }
}

// ============================================
// CLIENTE E EQUIPAMENTO
// ============================================

async function atualizarInfoCliente() {
  const clienteId = valorCampo("clienteSelect");
  const infoCliente = document.getElementById("infoCliente");

  if (!clienteId) {
    if (infoCliente) infoCliente.style.display = "none";
    clienteSelecionado = null;
    return;
  }

  try {
    const cliente = await buscarClientePorId(clienteId);

    if (!cliente) {
      mostrarMensagem("Erro", "Cliente não encontrado.", "error");
      clienteSelecionado = null;
      return;
    }

    preencherCampo("clienteTelefone", cliente.telefone || "");
    preencherCampo("clienteCelular", cliente.celular || "");
    preencherCampo("clienteCPF", cliente.cpf || "");
    preencherCampo(
      "clienteCidade",
      `${cliente.cidade || ""}${cliente.estado ? "/" + cliente.estado : ""}`,
    );

    if (infoCliente) {
      infoCliente.style.display = "block";
    }

    clienteSelecionado = cliente;
  } catch (error) {
    console.error("Erro ao carregar informações do cliente:", error);
    mostrarMensagem("Erro", "Erro ao carregar cliente.", "error");
  }
}

async function atualizarInfoEquipamento() {
  const equipamentoId = valorCampo("equipamentoSelect");
  const infoEquipamento = document.getElementById("infoEquipamento");

  if (!equipamentoId) {
    if (infoEquipamento) infoEquipamento.style.display = "none";
    return;
  }

  try {
    const equipamento = await buscarEquipamentoPorId(equipamentoId);

    if (!equipamento) {
      mostrarMensagem("Erro", "Equipamento não encontrado.", "error");
      return;
    }

    const quantidadeDisponivel = Number(equipamento.quantidadeDisponivel || 0);

    preencherCampo("equipamentoDisponivel", quantidadeDisponivel);
    preencherCampo(
      "equipamentoValorHora",
      formatarMoedaAluguel(equipamento.valorHora || 0),
    );
    preencherCampo(
      "equipamentoValorDia",
      formatarMoedaAluguel(equipamento.valorDia || 0),
    );
    preencherCampo(
      "equipamentoValorMes",
      formatarMoedaAluguel(equipamento.valorMes || 0),
    );

    const quantidadeInput = document.getElementById("quantidadeAlugar");

    if (quantidadeInput) {
      quantidadeInput.max = quantidadeDisponivel;
      quantidadeInput.value = quantidadeDisponivel > 0 ? 1 : 0;
    }

    const quantidadeCobrancaInput =
      document.getElementById("quantidadeCobranca");
    const unidadeCobrancaInfo = document.getElementById("unidadeCobrancaInfo");
    const labelQuantidadeCobranca = document.getElementById(
      "labelQuantidadeCobranca",
    );

    const rotuloUnidade = obterRotuloUnidadeCobranca(equipamento);
    const quantidadeCobranca = quantidadeCobradaPadrao(equipamento, 1);

    if (quantidadeCobrancaInput) {
      quantidadeCobrancaInput.value = quantidadeCobranca;
      quantidadeCobrancaInput.step = equipamento.permiteQuantidadeDecimal
        ? "0.01"
        : "1";
    }

    if (unidadeCobrancaInfo) {
      unidadeCobrancaInfo.textContent = `Cobrança por ${rotuloUnidade}. Estoque continua sendo controlado por unidade física.`;
    }

    if (labelQuantidadeCobranca) {
      labelQuantidadeCobranca.textContent = `Quantidade cobrada (${rotuloUnidade})`;
    }

    if (infoEquipamento) {
      infoEquipamento.style.display = "block";
    }

    if (equipamento.status !== "disponivel" || quantidadeDisponivel <= 0) {
      mostrarMensagem(
        "Atenção",
        "Este equipamento não possui estoque disponível para aluguel.",
        "warning",
      );
    }
  } catch (error) {
    console.error("Erro ao carregar informações do equipamento:", error);
    mostrarMensagem("Erro", "Erro ao carregar equipamento.", "error");
  }
}

function adicionarEquipamento() {
  const equipamentoSelect = document.getElementById("equipamentoSelect");
  const equipamentoId = valorCampo("equipamentoSelect");
  const quantidade = parseInt(valorCampo("quantidadeAlugar"), 10) || 0;
  const quantidadeCobranca =
    parseNumeroBR(valorCampo("quantidadeCobranca")) || quantidade;
  const periodo = valorCampo("periodo");

  if (!equipamentoId) {
    mostrarMensagem("Atenção", "Selecione um equipamento primeiro.", "warning");
    return;
  }

  if (!periodo) {
    mostrarMensagem(
      "Atenção",
      "Selecione o período antes de adicionar equipamentos.",
      "warning",
    );
    return;
  }

  if (quantidade <= 0) {
    mostrarMensagem("Erro", "A quantidade deve ser maior que zero.", "error");
    return;
  }

  if (quantidadeCobranca <= 0) {
    mostrarMensagem(
      "Erro",
      "A quantidade cobrada deve ser maior que zero.",
      "error",
    );
    return;
  }

  const option = equipamentoSelect.options[equipamentoSelect.selectedIndex];

  if (!option || !option.dataset.equipamento) {
    mostrarMensagem(
      "Erro",
      "Não foi possível ler os dados do equipamento selecionado.",
      "error",
    );
    return;
  }

  const equipamentoData = JSON.parse(option.dataset.equipamento);
  const quantidadeDisponivel = Number(
    equipamentoData.quantidadeDisponivel || 0,
  );

  const existente = equipamentosSelecionados.find(
    (item) => item.id === equipamentoId,
  );

  const quantidadeJaSelecionada = existente ? existente.quantidade : 0;

  if (quantidade + quantidadeJaSelecionada > quantidadeDisponivel) {
    mostrarMensagem(
      "Erro",
      `Quantidade indisponível. Estoque disponível: ${quantidadeDisponivel}.`,
      "error",
    );
    return;
  }

  if (existente) {
    existente.quantidade += quantidade;
    existente.quantidadeEstoque = existente.quantidade;
    existente.quantidadeCobrada =
      Number(existente.quantidadeCobrada || 0) + quantidadeCobranca;
  } else {
    const nomeEquipamento =
      equipamentoData.nomeEquipamento || equipamentoData.nome || "Equipamento";

    equipamentosSelecionados.push({
      id: equipamentoId,
      equipamentoId,
      nome: nomeEquipamento,
      nomeEquipamento,
      quantidade,
      quantidadeEstoque: quantidade,
      quantidadeCobrada,
      unidadeCobranca: equipamentoData.unidadeCobranca || "unidade",
      rotuloUnidadeCobranca:
        equipamentoData.rotuloUnidadeCobranca ||
        obterRotuloUnidadeCobranca(equipamentoData),
      permiteQuantidadeDecimal: Boolean(
        equipamentoData.permiteQuantidadeDecimal,
      ),
      valorHora: Number(equipamentoData.valorHora || 0),
      valorDia: Number(equipamentoData.valorDia || 0),
      valorMes: Number(equipamentoData.valorMes || 0),
    });
  }

  atualizarListaEquipamentos();
  calcularValor();

  equipamentoSelect.value = "";

  const infoEquipamento = document.getElementById("infoEquipamento");
  if (infoEquipamento) infoEquipamento.style.display = "none";

  preencherCampo("quantidadeAlugar", 1);

  mostrarMensagem("Sucesso", "Equipamento adicionado à lista!");
}

function atualizarListaEquipamentos() {
  const lista = document.getElementById("listaEquipamentos");
  const container = document.getElementById("listaEquipamentosContainer");

  if (!lista || !container) {
    return;
  }

  if (equipamentosSelecionados.length === 0) {
    container.style.display = "none";
    lista.innerHTML = "";
    return;
  }

  container.style.display = "block";

  lista.innerHTML = equipamentosSelecionados
    .map((item, index) => {
      const valorUnitario = getValorPorPeriodo(item);
      const quantidadeCobrada = Number(
        item.quantidadeCobrada || item.quantidade || 1,
      );
      const subtotal = valorUnitario * quantidadeCobrada;
      const rotuloUnidade = obterRotuloUnidadeCobranca(item);

      return `
        <tr>
          <td>${escaparHTMLAluguel(item.nomeEquipamento)}</td>
          <td>
            ${item.quantidadeEstoque || item.quantidade} unid. estoque
            <small style="display:block; color:#666;">
              Cobrança: ${quantidadeCobrada} ${rotuloUnidade}
            </small>
          </td>
          <td>${formatarMoedaAluguel(valorUnitario)}</td>
          <td>${formatarMoedaAluguel(subtotal)}</td>
          <td>
            <button class="btn btn-small btn-danger" onclick="removerEquipamento(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function removerEquipamento(index) {
  equipamentosSelecionados.splice(index, 1);
  atualizarListaEquipamentos();
  calcularValor();
}

function calcularValor() {
  const periodo = valorCampo("periodo");
  const duracao = parseInt(valorCampo("duracao"), 10) || 1;
  const resumoAluguel = document.getElementById("resumoAluguel");

  if (!periodo || equipamentosSelecionados.length === 0) {
    if (resumoAluguel) resumoAluguel.style.display = "none";
    return;
  }

  const { subtotal, valorTotal } = obterResumoNumerico();

  preencherCampo("subtotal", formatarMoedaAluguel(subtotal));
  preencherCampo("periodoTexto", obterTextoPeriodo(periodo));
  preencherCampo(
    "duracaoTexto",
    `${duracao} ${periodo}${duracao > 1 ? "s" : ""}`,
  );
  preencherCampo("valorTotal", formatarMoedaAluguel(valorTotal));

  if (resumoAluguel) {
    resumoAluguel.style.display = "block";
  }

  atualizarListaEquipamentos();
}

// ============================================
// REGISTRO DE ALUGUEL
// ============================================

async function registrarAluguel(event) {
  event.preventDefault();

  const erro = validarFormularioAluguel();

  if (erro) {
    mostrarMensagem("Erro", erro, "error");
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const textoOriginal = submitBtn ? submitBtn.innerHTML : "";

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Registrando...';
  }

  try {
    const clienteId = valorCampo("clienteSelect");
    const dataInicio = valorCampo("dataInicio");
    const periodo = valorCampo("periodo");
    const duracao = parseInt(valorCampo("duracao"), 10) || 1;
    const observacoes = valorCampo("observacoesAluguel");

    if (!clienteSelecionado || clienteSelecionado.id !== clienteId) {
      clienteSelecionado = await buscarClientePorId(clienteId);
    }

    if (!clienteSelecionado) {
      throw new Error("Cliente selecionado não foi encontrado.");
    }

    const aluguelId = await AluguelService.registrar({
      clienteId,
      cliente: clienteSelecionado,
      dataInicio,
      periodo,
      duracao,
      observacoes,
      equipamentos: equipamentosSelecionados,
    });

    mostrarMensagem("Sucesso", "Aluguel registrado com sucesso!");

    limparFormularioAluguel();
    await carregarAlugueis();

    const btnImprimir = document.getElementById("btnImprimir");

    if (btnImprimir) {
      btnImprimir.dataset.aluguelId = aluguelId;
      btnImprimir.disabled = false;
      btnImprimir.style.display = "inline-flex";
    }
  } catch (error) {
    console.error("Erro ao registrar aluguel:", error);

    mostrarMensagem(
      "Erro",
      "Erro ao registrar aluguel: " + error.message,
      "error",
    );
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = textoOriginal;
    }
  }
}

// ============================================
// LISTAGEM DE ALUGUÉIS
// ============================================

async function carregarAlugueis() {
  const alugueisList = document.getElementById("alugueisList");

  if (!alugueisList) {
    return;
  }

  try {
    alugueisList.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando aluguéis...</p>
        </td>
      </tr>
    `;

    alugueis = await AluguelService.listar();

    if (!alugueis.length) {
      alugueisList.innerHTML = `
        <tr>
          <td colspan="7" class="empty-message">
            <i class="fas fa-file-contract"></i>
            <p>Nenhum aluguel registrado ainda</p>
          </td>
        </tr>
      `;
      return;
    }

    alugueisList.innerHTML = alugueis
      .map((aluguel) => {
        const equipamentos =
          aluguel.equipamentosDetalhes || aluguel.equipamentos || [];

        const equipamentosLista = equipamentos
          .map((e) => `${e.quantidade}x ${e.nomeEquipamento || e.nome}`)
          .join(", ");

        let statusClass = "status-available";
        let statusText = "Ativo";

        if (aluguel.status === "finalizado") {
          statusClass = "status-success";
          statusText = "Finalizado";
        } else if (aluguel.status === "cancelado") {
          statusClass = "status-unavailable";
          statusText = "Cancelado";
        } else if (
          aluguel.status === "ativo" &&
          aluguel.dataDevolucao &&
          new Date(aluguel.dataDevolucao) < new Date(dataHojeISO())
        ) {
          statusClass = "status-warning";
          statusText = "Atrasado";
        }

        const clienteNome = escaparHTMLAluguel(aluguel.clienteNome || "");
        const equipamentosTexto = escaparHTMLAluguel(equipamentosLista);
        const equipamentosResumo =
          equipamentosTexto.length > 50
            ? equipamentosTexto.substring(0, 50) + "..."
            : equipamentosTexto;

        return `
          <tr>
            <td>
              <strong>${clienteNome}</strong>
              <br><small>${formatarData(aluguel.dataInicio)}</small>
            </td>

            <td>
              <small>${equipamentosResumo}</small>
            </td>

            <td>${formatarData(aluguel.dataInicio)}</td>

            <td>${obterTextoPeriodo(aluguel.periodo)}</td>

            <td>
              ${
                aluguel.status === "ativo"
                  ? "<small>A calcular na devolução</small>"
                  : formatarMoedaAluguel(aluguel.valorTotal || 0)
              }
            </td>

            <td>
              <span class="status-badge ${statusClass}">
                ${statusText}
              </span>
            </td>

            <td>
              <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button class="btn btn-small btn-primary" onclick="visualizarAluguel('${aluguel.id}')">
                  <i class="fas fa-eye"></i>
                </button>

                <button class="btn btn-small btn-success" onclick="imprimirAluguel('${aluguel.id}')">
                  <i class="fas fa-print"></i>
                </button>

                <button
                  class="btn btn-small btn-danger"
                  onclick="finalizarAluguel('${aluguel.id}')"
                  ${aluguel.status === "finalizado" ? "disabled" : ""}
                >
                  <i class="fas fa-check"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Erro ao carregar aluguéis:", error);

    alugueisList.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #e74c3c;">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar aluguéis</p>
          <small>${escaparHTMLAluguel(error.message)}</small>
        </td>
      </tr>
    `;
  }
}

function buscarAlugueis() {
  const termo = valorCampo("searchAlugueis").toLowerCase();
  const linhas = document.querySelectorAll("#alugueisList tr");

  linhas.forEach((linha) => {
    const textoLinha = linha.textContent.toLowerCase();
    linha.style.display = textoLinha.includes(termo) ? "" : "none";
  });
}

// ============================================
// FINALIZAÇÃO DE ALUGUEL
// ============================================

async function finalizarAluguel(aluguelId) {
  const aluguel = alugueis.find((item) => item.id === aluguelId);

  if (!aluguel) {
    mostrarMensagem("Erro", "Aluguel não encontrado na lista.", "error");
    return;
  }

  if (aluguel.status === "finalizado") {
    mostrarMensagem("Atenção", "Este aluguel já está finalizado.", "warning");
    return;
  }

  const confirmar = confirm(
    "Tem certeza que deseja finalizar este aluguel?\n\nEsta ação devolverá os equipamentos ao estoque e calculará o valor final.",
  );

  if (!confirmar) {
    return;
  }

  const dataDevolucaoReal =
    prompt("Informe a data real de devolução:", dataHojeISO()) || dataHojeISO();

  const equipamentos =
    aluguel.equipamentosDetalhes || aluguel.equipamentos || [];
  const itensFechamento = [];

  for (const item of equipamentos) {
    const nome = item.nomeEquipamento || item.nome || "Equipamento";
    const rotulo = obterRotuloUnidadeCobranca(item);
    const quantidadeAtual =
      item.quantidadeCobradaFinal ||
      item.quantidadeCobrada ||
      item.quantidade ||
      1;

    const resposta = prompt(
      `Quantidade cobrada para:\n${nome}\n\nUnidade de cobrança: ${rotulo}`,
      String(quantidadeAtual).replace(".", ","),
    );

    if (resposta === null) {
      mostrarMensagem("Atenção", "Finalização cancelada.", "warning");
      return;
    }

    const quantidadeCobradaFinal = parseNumeroBR(resposta);

    if (quantidadeCobradaFinal <= 0) {
      mostrarMensagem(
        "Erro",
        `Quantidade cobrada inválida para "${nome}".`,
        "error",
      );
      return;
    }

    itensFechamento.push({
      equipamentoId: item.equipamentoId || item.id,
      quantidadeCobradaFinal,
    });
  }

  const desconto = parseNumeroBR(prompt("Desconto em R$:", "0") || "0");
  const acrescimo = parseNumeroBR(prompt("Acréscimo em R$:", "0") || "0");

  let valorPagoTexto = prompt(
    "Valor pago em R$:\n\nDeixe vazio para considerar pagamento total.",
    "",
  );

  const formaPagamento = prompt("Forma de pagamento:", "Dinheiro") || "";

  const fechamento = {
    dataDevolucaoReal,
    itensFechamento,
    desconto,
    acrescimo,
    formaPagamento,
  };

  if (valorPagoTexto !== null && valorPagoTexto.trim() !== "") {
    fechamento.valorPago = parseNumeroBR(valorPagoTexto);
  }

  try {
    await AluguelService.finalizar(aluguelId, fechamento);

    mostrarMensagem("Sucesso", "Aluguel finalizado e cobrança calculada!");

    await carregarAlugueis();
    await carregarEquipamentosParaSelect("equipamentoSelect");
  } catch (error) {
    console.error("Erro ao finalizar aluguel:", error);

    mostrarMensagem(
      "Erro",
      "Erro ao finalizar aluguel: " + error.message,
      "error",
    );
  }
}

// ============================================
// IMPRESSÃO, VISUALIZAÇÃO E LIMPEZA
// ============================================

function visualizarAluguel(aluguelId) {
  const aluguel = alugueis.find((item) => item.id === aluguelId);

  if (!aluguel) {
    mostrarMensagem("Erro", "Aluguel não encontrado na lista.", "error");
    return;
  }

  const equipamentos =
    aluguel.equipamentosDetalhes || aluguel.equipamentos || [];

  const listaEquipamentos = equipamentos
    .map((item) => `${item.quantidade}x ${item.nomeEquipamento || item.nome}`)
    .join("\n");

  alert(
    `Cliente: ${aluguel.clienteNome}\n` +
      `Data de início: ${formatarData(aluguel.dataInicio)}\n` +
      `Data de devolução: ${formatarData(aluguel.dataDevolucao)}\n` +
      `Período: ${obterTextoPeriodo(aluguel.periodo)}\n` +
      `Duração: ${aluguel.duracao}\n` +
      `Valor total: ${formatarMoedaAluguel(aluguel.valorTotal || 0)}\n\n` +
      `Equipamentos:\n${listaEquipamentos}`,
  );
}

function imprimirAluguel(aluguelId) {
  localStorage.setItem("aluguelParaImprimir", aluguelId);
  window.open("imprimir.html?id=" + aluguelId, "_blank");
}

function imprimirContrato() {
  const btnImprimir = document.getElementById("btnImprimir");
  const aluguelId = btnImprimir?.dataset?.aluguelId;

  if (!aluguelId) {
    alert("Registre um aluguel primeiro para poder imprimir o contrato.");
    return;
  }

  imprimirAluguel(aluguelId);
}

function limparFormularioAluguel() {
  const form = document.getElementById("aluguelForm");

  if (form) {
    form.reset();
  }

  equipamentosSelecionados = [];
  clienteSelecionado = null;

  preencherCampo("dataInicio", dataHojeISO());
  preencherCampo("duracao", 1);
  preencherCampo("subtotal", formatarMoedaAluguel(0));
  preencherCampo("periodoTexto", "");
  preencherCampo("duracaoTexto", "");
  preencherCampo("valorTotal", formatarMoedaAluguel(0));
  preencherCampo("quantidadeAlugar", 1);

  const secoesParaOcultar = [
    "infoCliente",
    "infoEquipamento",
    "listaEquipamentosContainer",
    "resumoAluguel",
  ];

  secoesParaOcultar.forEach((id) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.style.display = "none";
  });

  const listaEquipamentos = document.getElementById("listaEquipamentos");

  if (listaEquipamentos) {
    listaEquipamentos.innerHTML = "";
  }

  const btnImprimir = document.getElementById("btnImprimir");

  if (btnImprimir) {
    btnImprimir.disabled = true;
    btnImprimir.style.display = "none";
    delete btnImprimir.dataset.aluguelId;
  }

  carregarClientesParaSelect("clienteSelect");
  carregarEquipamentosParaSelect("equipamentoSelect");
}
