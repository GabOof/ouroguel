let alugueis = [];
let clientes = [];
let equipamentosDisponiveis = [];
let equipamentosSelecionados = [];
let clienteSelecionado = null;
let aluguelEmFechamento = null;

// ============================================
// FUNÇÕES AUXILIARES
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

function setTexto(id, valor) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = valor ?? "";
  }
}

function escaparHTMLAluguel(valor) {
  const div = document.createElement("div");
  div.textContent = String(valor || "");
  return div.innerHTML;
}

function mostrarMensagemLocal(titulo, mensagem, tipo = "success") {
  if (typeof mostrarMensagem === "function") {
    mostrarMensagem(titulo, mensagem, tipo);
    return;
  }

  console[tipo === "error" ? "error" : "log"](`${titulo}: ${mensagem}`);
  alert(`${titulo}\n\n${mensagem}`);
}

function formatarMoedaAluguel(valor) {
  const numero = Number(valor || 0);

  if (typeof formatarMoeda === "function") {
    return formatarMoeda(numero);
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numero);
}

function formatarMoedaInput(valor) {
  return Number(valor || 0)
    .toFixed(2)
    .replace(".", ",");
}

function parseNumeroBR(valor) {
  if (typeof valor === "number") {
    return valor;
  }

  const texto = String(valor || "")
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function dataHojeISO() {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().split("T")[0];
}

function formatarDataAluguel(dataISO) {
  if (!dataISO) {
    return "-";
  }

  const [ano, mes, dia] = String(dataISO).split("-");

  if (!ano || !mes || !dia) {
    return dataISO;
  }

  return `${dia}/${mes}/${ano}`;
}

function criarDataLocal(dataISO) {
  const [ano, mes, dia] = String(dataISO || "")
    .split("-")
    .map(Number);

  if (!ano || !mes || !dia) {
    return new Date();
  }

  return new Date(ano, mes - 1, dia);
}

function calcularDataDevolucaoLocal(dataInicio, periodo, duracao) {
  const data = criarDataLocal(dataInicio);
  const quantidade = Number(duracao || 1);

  if (periodo === "hora") {
    data.setHours(data.getHours() + quantidade);
  }

  if (periodo === "dia") {
    data.setDate(data.getDate() + quantidade);
  }

  if (periodo === "mes") {
    data.setMonth(data.getMonth() + quantidade);
  }

  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().split("T")[0];
}

function calcularDuracaoRealLocal(dataInicio, dataFim, periodo) {
  const inicio = criarDataLocal(dataInicio);
  const fim = criarDataLocal(dataFim || dataHojeISO());
  const diffMs = Math.max(0, fim.getTime() - inicio.getTime());

  if (periodo === "hora") {
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  }

  if (periodo === "mes") {
    let meses =
      (fim.getFullYear() - inicio.getFullYear()) * 12 +
      (fim.getMonth() - inicio.getMonth());

    if (fim.getDate() > inicio.getDate()) {
      meses += 1;
    }

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

function obterRotuloDuracao(periodo, duracao) {
  const quantidade = Number(duracao || 1);

  if (periodo === "hora") {
    return `${quantidade} hora${quantidade > 1 ? "s" : ""}`;
  }

  if (periodo === "mes") {
    return `${quantidade} mês${quantidade > 1 ? "es" : ""}`;
  }

  return `${quantidade} dia${quantidade > 1 ? "s" : ""}`;
}

function obterValorPorPeriodo(equipamento, periodo) {
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

function quantidadeCobradaPadrao(equipamento, quantidadeEstoque) {
  const unidade = equipamento.unidadeCobranca || "unidade";

  if (["metro", "metro2", "quilo", "dosagem", "duzia"].includes(unidade)) {
    return 1;
  }

  return quantidadeEstoque || 1;
}

function possuiPrecoNoPeriodo(equipamento, periodo) {
  return obterValorPorPeriodo(equipamento, periodo) > 0;
}

async function aguardarDependenciasAluguel() {
  if (window.firebaseReady) {
    await window.firebaseReady;
  }

  if (!window.AluguelService) {
    throw new Error("AluguelService não foi carregado.");
  }
}

// ============================================
// INICIALIZAÇÃO
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
    dataInicio.addEventListener("change", calcularResumoPrevisto);
  }

  const periodo = document.getElementById("periodo");

  if (periodo) {
    periodo.addEventListener("change", () => {
      popularEquipamentosSelect();
      limparInfoEquipamento();
      calcularResumoPrevisto();
    });
  }

  const duracao = document.getElementById("duracaoPrevista");

  if (duracao) {
    duracao.value = duracao.value || 1;
    duracao.addEventListener("input", calcularResumoPrevisto);
  }

  const clienteSelect = document.getElementById("clienteSelect");

  if (clienteSelect) {
    clienteSelect.addEventListener("change", atualizarInfoCliente);
  }

  const equipamentoSelect = document.getElementById("equipamentoSelect");

  if (equipamentoSelect) {
    equipamentoSelect.addEventListener("change", atualizarInfoEquipamento);
  }

  const quantidadeAlugar = document.getElementById("quantidadeAlugar");

  if (quantidadeAlugar) {
    quantidadeAlugar.addEventListener(
      "input",
      atualizarQuantidadeCobradaPadrao,
    );
  }

  const quantidadeCobranca = document.getElementById("quantidadeCobranca");

  if (quantidadeCobranca) {
    quantidadeCobranca.addEventListener("input", calcularResumoPrevisto);
  }

  const btnAdicionar = document.getElementById("btnAdicionarEquipamento");

  if (btnAdicionar) {
    btnAdicionar.addEventListener("click", adicionarEquipamento);
  }

  const btnLimpar = document.getElementById("btnLimparAluguel");

  if (btnLimpar) {
    btnLimpar.addEventListener("click", limparFormularioAluguel);
  }

  const buscaAlugueis = document.getElementById("searchAlugueis");

  if (buscaAlugueis) {
    buscaAlugueis.addEventListener("input", buscarAlugueis);
  }

  configurarModalFechamento();
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await aguardarDependenciasAluguel();

    configurarFormularioAluguel();

    await Promise.all([
      carregarClientes(),
      carregarEquipamentosDisponiveis(),
      carregarAlugueis(),
    ]);

    await aplicarPreSelecoes();
    calcularResumoPrevisto();
  } catch (error) {
    console.error("Erro ao inicializar tela de aluguel:", error);

    mostrarMensagemLocal(
      "Erro",
      "Não foi possível inicializar a tela de aluguéis: " + error.message,
      "error",
    );
  }
});

async function aplicarPreSelecoes() {
  const clienteId = localStorage.getItem("clienteSelecionado");

  if (clienteId) {
    preencherCampo("clienteSelect", clienteId);
    await atualizarInfoCliente();
    localStorage.removeItem("clienteSelecionado");
  }

  const equipamentoId = localStorage.getItem("equipamentoSelecionado");

  if (equipamentoId) {
    preencherCampo("equipamentoSelect", equipamentoId);
    await atualizarInfoEquipamento();
    localStorage.removeItem("equipamentoSelecionado");
  }
}

// ============================================
// CLIENTES
// ============================================

async function carregarClientes() {
  clientes = await AluguelService.listarClientes();

  const select = document.getElementById("clienteSelect");

  if (!select) {
    return;
  }

  select.innerHTML = '<option value="">Selecione um cliente</option>';

  clientes.forEach((cliente) => {
    const option = document.createElement("option");
    option.value = cliente.id;
    option.textContent = cliente.nome || "Cliente sem nome";
    select.appendChild(option);
  });
}

async function atualizarInfoCliente() {
  const clienteId = valorCampo("clienteSelect");
  const infoCliente = document.getElementById("infoCliente");

  if (!clienteId) {
    clienteSelecionado = null;
    if (infoCliente) infoCliente.style.display = "none";
    return;
  }

  clienteSelecionado = clientes.find((cliente) => cliente.id === clienteId);

  if (!clienteSelecionado) {
    clienteSelecionado = await AluguelService.obterClientePorId(clienteId);
  }

  if (!clienteSelecionado) {
    mostrarMensagemLocal("Erro", "Cliente não encontrado.", "error");
    if (infoCliente) infoCliente.style.display = "none";
    return;
  }

  preencherCampo("clienteTelefone", clienteSelecionado.telefone || "");
  preencherCampo("clienteCelular", clienteSelecionado.celular || "");
  preencherCampo("clienteCPF", clienteSelecionado.cpf || "");
  preencherCampo(
    "clienteCidade",
    `${clienteSelecionado.cidade || ""}${
      clienteSelecionado.estado ? "/" + clienteSelecionado.estado : ""
    }`,
  );

  if (infoCliente) {
    infoCliente.style.display = "block";
  }
}

// ============================================
// EQUIPAMENTOS
// ============================================

async function carregarEquipamentosDisponiveis() {
  equipamentosDisponiveis =
    await AluguelService.listarEquipamentosDisponiveis();
  popularEquipamentosSelect();
}

function popularEquipamentosSelect() {
  const select = document.getElementById("equipamentoSelect");

  if (!select) {
    return;
  }

  const periodo = valorCampo("periodo");

  select.innerHTML = '<option value="">Selecione um equipamento</option>';

  if (!periodo) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Selecione o período primeiro";
    select.appendChild(option);
    return;
  }

  const filtrados = equipamentosDisponiveis.filter((equipamento) =>
    possuiPrecoNoPeriodo(equipamento, periodo),
  );

  filtrados.forEach((equipamento) => {
    const option = document.createElement("option");
    const valorUnitario = obterValorPorPeriodo(equipamento, periodo);
    const rotuloUnidade = obterRotuloUnidadeCobranca(equipamento);

    option.value = equipamento.id;
    option.textContent = `${equipamento.nomeEquipamento} — ${formatarMoedaAluguel(
      valorUnitario,
    )}/${rotuloUnidade}`;
    option.dataset.equipamento = JSON.stringify(equipamento);
    select.appendChild(option);
  });
}

function obterEquipamentoSelecionadoNoSelect() {
  const select = document.getElementById("equipamentoSelect");

  if (!select || !select.value) {
    return null;
  }

  const option = select.options[select.selectedIndex];

  if (!option || !option.dataset.equipamento) {
    return null;
  }

  try {
    return JSON.parse(option.dataset.equipamento);
  } catch (error) {
    console.error("Erro ao ler dados do equipamento:", error);
    return null;
  }
}

async function atualizarInfoEquipamento() {
  const equipamento = obterEquipamentoSelecionadoNoSelect();
  const infoEquipamento = document.getElementById("infoEquipamento");

  if (!equipamento) {
    limparInfoEquipamento();
    return;
  }

  const periodo = valorCampo("periodo");
  const quantidadeDisponivel = Number(equipamento.quantidadeDisponivel || 0);
  const valorUnitario = obterValorPorPeriodo(equipamento, periodo);
  const rotuloUnidade = obterRotuloUnidadeCobranca(equipamento);

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
  preencherCampo(
    "equipamentoValorPeriodo",
    formatarMoedaAluguel(valorUnitario),
  );

  const quantidadeInput = document.getElementById("quantidadeAlugar");

  if (quantidadeInput) {
    quantidadeInput.max = quantidadeDisponivel;
    quantidadeInput.value = quantidadeDisponivel > 0 ? 1 : 0;
  }

  const quantidadeCobrancaInput = document.getElementById("quantidadeCobranca");

  if (quantidadeCobrancaInput) {
    quantidadeCobrancaInput.value = quantidadeCobradaPadrao(equipamento, 1);
    quantidadeCobrancaInput.step = equipamento.permiteQuantidadeDecimal
      ? "0.01"
      : "1";
  }

  setTexto("labelQuantidadeCobranca", `Quantidade cobrada (${rotuloUnidade})`);
  setTexto(
    "unidadeCobrancaInfo",
    `Cobrança por ${rotuloUnidade}. O estoque continua sendo reservado por unidade física.`,
  );

  if (infoEquipamento) {
    infoEquipamento.style.display = "block";
  }

  calcularResumoPrevisto();
}

function limparInfoEquipamento() {
  const infoEquipamento = document.getElementById("infoEquipamento");

  if (infoEquipamento) {
    infoEquipamento.style.display = "none";
  }

  preencherCampo("equipamentoDisponivel", "");
  preencherCampo("equipamentoValorHora", "");
  preencherCampo("equipamentoValorDia", "");
  preencherCampo("equipamentoValorMes", "");
  preencherCampo("equipamentoValorPeriodo", "");
  preencherCampo("quantidadeAlugar", 1);
  preencherCampo("quantidadeCobranca", 1);
  setTexto("unidadeCobrancaInfo", "");
  setTexto("labelQuantidadeCobranca", "Quantidade cobrada");
}

function atualizarQuantidadeCobradaPadrao() {
  const equipamento = obterEquipamentoSelecionadoNoSelect();

  if (!equipamento) {
    return;
  }

  const quantidadeEstoque = parseInt(valorCampo("quantidadeAlugar"), 10) || 1;
  const quantidadeCobranca = document.getElementById("quantidadeCobranca");

  if (quantidadeCobranca && !quantidadeCobranca.dataset.editadoManualmente) {
    quantidadeCobranca.value = quantidadeCobradaPadrao(
      equipamento,
      quantidadeEstoque,
    );
  }

  calcularResumoPrevisto();
}

function adicionarEquipamento() {
  const equipamento = obterEquipamentoSelecionadoNoSelect();
  const periodo = valorCampo("periodo");
  const quantidadeEstoque = parseInt(valorCampo("quantidadeAlugar"), 10) || 0;
  const quantidadeCobrada = parseNumeroBR(valorCampo("quantidadeCobranca"));

  if (!periodo) {
    mostrarMensagemLocal(
      "Atenção",
      "Selecione o período antes de adicionar equipamentos.",
      "warning",
    );
    return;
  }

  if (!equipamento) {
    mostrarMensagemLocal(
      "Atenção",
      "Selecione um equipamento primeiro.",
      "warning",
    );
    return;
  }

  if (quantidadeEstoque <= 0) {
    mostrarMensagemLocal(
      "Erro",
      "A quantidade retirada do estoque deve ser maior que zero.",
      "error",
    );
    return;
  }

  if (quantidadeCobrada <= 0) {
    mostrarMensagemLocal(
      "Erro",
      "A quantidade cobrada deve ser maior que zero.",
      "error",
    );
    return;
  }

  const quantidadeDisponivel = Number(equipamento.quantidadeDisponivel || 0);
  const existente = equipamentosSelecionados.find(
    (item) => item.id === equipamento.id,
  );
  const quantidadeJaSelecionada = existente
    ? Number(existente.quantidadeEstoque || 0)
    : 0;

  if (quantidadeEstoque + quantidadeJaSelecionada > quantidadeDisponivel) {
    mostrarMensagemLocal(
      "Erro",
      `Quantidade indisponível. Estoque disponível: ${quantidadeDisponivel}.`,
      "error",
    );
    return;
  }

  const valorUnitario = obterValorPorPeriodo(equipamento, periodo);

  if (valorUnitario <= 0) {
    mostrarMensagemLocal(
      "Erro",
      `Este equipamento não possui valor configurado para ${obterTextoPeriodo(periodo).toLowerCase()}.`,
      "error",
    );
    return;
  }

  if (existente) {
    existente.quantidadeEstoque += quantidadeEstoque;
    existente.quantidade = existente.quantidadeEstoque;
    existente.quantidadeCobrada += quantidadeCobrada;
    existente.quantidadeCobradaPrevista = existente.quantidadeCobrada;
  } else {
    equipamentosSelecionados.push({
      id: equipamento.id,
      equipamentoId: equipamento.id,
      nome: equipamento.nomeEquipamento || equipamento.nome || "Equipamento",
      nomeEquipamento:
        equipamento.nomeEquipamento || equipamento.nome || "Equipamento",

      quantidade: quantidadeEstoque,
      quantidadeEstoque,

      quantidadeCobrada,
      quantidadeCobradaPrevista: quantidadeCobrada,

      unidadeCobranca: equipamento.unidadeCobranca || "unidade",
      rotuloUnidadeCobranca:
        equipamento.rotuloUnidadeCobranca ||
        obterRotuloUnidadeCobranca(equipamento),
      permiteQuantidadeDecimal: Boolean(equipamento.permiteQuantidadeDecimal),

      valorUnitario,
      valorHora: Number(equipamento.valorHora || 0),
      valorDia: Number(equipamento.valorDia || 0),
      valorMes: Number(equipamento.valorMes || 0),
    });
  }

  atualizarListaEquipamentos();
  calcularResumoPrevisto();

  preencherCampo("equipamentoSelect", "");
  limparInfoEquipamento();

  mostrarMensagemLocal("Sucesso", "Equipamento adicionado à lista!");
}

function removerEquipamento(index) {
  equipamentosSelecionados.splice(index, 1);
  atualizarListaEquipamentos();
  calcularResumoPrevisto();
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
      const rotulo = obterRotuloUnidadeCobranca(item);
      const subtotal =
        Number(item.valorUnitario || 0) * Number(item.quantidadeCobrada || 0);

      return `
        <tr>
          <td>
            <strong>${escaparHTMLAluguel(item.nomeEquipamento)}</strong>
            <small style="display:block; color:#666;">
              Cobrança por ${escaparHTMLAluguel(rotulo)}
            </small>
          </td>
          <td>${item.quantidadeEstoque} unid.</td>
          <td>${item.quantidadeCobrada} ${escaparHTMLAluguel(rotulo)}</td>
          <td>${formatarMoedaAluguel(item.valorUnitario)}</td>
          <td>${formatarMoedaAluguel(subtotal)}</td>
          <td>
            <button type="button" class="btn btn-small btn-danger" onclick="removerEquipamento(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function calcularResumoPrevisto() {
  const periodo = valorCampo("periodo");
  const dataInicio = valorCampo("dataInicio") || dataHojeISO();
  const duracaoPrevista = parseInt(valorCampo("duracaoPrevista"), 10) || 1;
  const resumo = document.getElementById("resumoAluguel");

  let subtotal = 0;

  equipamentosSelecionados.forEach((item) => {
    subtotal +=
      Number(item.valorUnitario || 0) * Number(item.quantidadeCobrada || 0);
  });

  const valorPrevisto = subtotal * duracaoPrevista;
  const dataDevolucaoPrevista = periodo
    ? calcularDataDevolucaoLocal(dataInicio, periodo, duracaoPrevista)
    : "";

  preencherCampo("subtotalPrevisto", formatarMoedaAluguel(subtotal));
  preencherCampo("periodoTexto", obterTextoPeriodo(periodo));
  preencherCampo(
    "duracaoTexto",
    periodo ? obterRotuloDuracao(periodo, duracaoPrevista) : "",
  );
  preencherCampo(
    "dataDevolucaoPrevista",
    dataDevolucaoPrevista ? formatarDataAluguel(dataDevolucaoPrevista) : "",
  );
  preencherCampo("valorPrevisto", formatarMoedaAluguel(valorPrevisto));

  if (resumo) {
    resumo.style.display = equipamentosSelecionados.length ? "block" : "none";
  }
}

// ============================================
// REGISTRO DO ALUGUEL
// ============================================

function validarFormularioAluguel() {
  const clienteId = valorCampo("clienteSelect");
  const dataInicio = valorCampo("dataInicio");
  const periodo = valorCampo("periodo");
  const duracaoPrevista = parseInt(valorCampo("duracaoPrevista"), 10) || 0;

  if (!clienteId) {
    return "Selecione um cliente.";
  }

  if (!dataInicio) {
    return "Informe a data de início.";
  }

  if (!periodo) {
    return "Selecione o período de cobrança.";
  }

  if (duracaoPrevista <= 0) {
    return "A duração prevista deve ser maior que zero.";
  }

  if (equipamentosSelecionados.length === 0) {
    return "Adicione pelo menos um equipamento.";
  }

  return null;
}

async function registrarAluguel(event) {
  event.preventDefault();

  const erroValidacao = validarFormularioAluguel();

  if (erroValidacao) {
    mostrarMensagemLocal("Erro", erroValidacao, "error");
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

    if (!clienteSelecionado || clienteSelecionado.id !== clienteId) {
      clienteSelecionado = await AluguelService.obterClientePorId(clienteId);
    }

    if (!clienteSelecionado) {
      throw new Error("Cliente selecionado não foi encontrado.");
    }

    const aluguelId = await AluguelService.registrar({
      clienteId,
      cliente: clienteSelecionado,
      dataInicio: valorCampo("dataInicio"),
      periodo: valorCampo("periodo"),
      duracaoPrevista: parseInt(valorCampo("duracaoPrevista"), 10) || 1,
      observacoes: valorCampo("observacoesAluguel"),
      equipamentos: equipamentosSelecionados,
    });

    mostrarMensagemLocal(
      "Sucesso",
      "Aluguel registrado e estoque reservado com sucesso!",
    );

    limparFormularioAluguel();
    await carregarEquipamentosDisponiveis();
    await carregarAlugueis();

    const btnImprimir = document.getElementById("btnImprimir");

    if (btnImprimir) {
      btnImprimir.dataset.aluguelId = aluguelId;
      btnImprimir.disabled = false;
      btnImprimir.style.display = "inline-flex";
    }
  } catch (error) {
    console.error("Erro ao registrar aluguel:", error);
    mostrarMensagemLocal(
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
// LISTAGEM
// ============================================

async function carregarAlugueis() {
  const lista = document.getElementById("alugueisList");

  if (!lista) {
    return;
  }

  try {
    lista.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:40px;">
          <i class="fas fa-spinner fa-spin" style="font-size:24px; color:#3498db;"></i>
          <p>Carregando aluguéis...</p>
        </td>
      </tr>
    `;

    alugueis = await AluguelService.listar();

    if (!alugueis.length) {
      lista.innerHTML = `
        <tr>
          <td colspan="8" class="empty-message">
            <i class="fas fa-file-contract"></i>
            <p>Nenhum aluguel registrado ainda</p>
          </td>
        </tr>
      `;
      return;
    }

    lista.innerHTML = alugueis.map(renderizarLinhaAluguel).join("");
  } catch (error) {
    console.error("Erro ao carregar aluguéis:", error);

    lista.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:40px; color:#e74c3c;">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar aluguéis</p>
          <small>${escaparHTMLAluguel(error.message)}</small>
        </td>
      </tr>
    `;
  }
}

function renderizarLinhaAluguel(aluguel) {
  const equipamentos =
    aluguel.equipamentosDetalhes || aluguel.equipamentos || [];
  const equipamentosResumo = equipamentos
    .map((item) => {
      const nome = item.nomeEquipamento || item.nome || "Equipamento";
      const quantidade = item.quantidadeEstoque || item.quantidade || 0;
      return `${quantidade}x ${nome}`;
    })
    .join(", ");

  const resumoCurto =
    equipamentosResumo.length > 70
      ? equipamentosResumo.substring(0, 70) + "..."
      : equipamentosResumo;

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
    aluguel.dataDevolucaoPrevista &&
    new Date(aluguel.dataDevolucaoPrevista) < new Date(dataHojeISO())
  ) {
    statusClass = "status-warning";
    statusText = "Atrasado";
  }

  const valor =
    aluguel.status === "finalizado"
      ? formatarMoedaAluguel(aluguel.valorTotal || 0)
      : "A calcular na devolução";

  const pagamento =
    aluguel.status === "finalizado"
      ? aluguel.statusPagamento || "pendente"
      : "pendente";

  return `
    <tr>
      <td>
        <strong>${escaparHTMLAluguel(aluguel.clienteNome || "")}</strong>
        <small style="display:block; color:#666;">
          ${escaparHTMLAluguel(aluguel.clienteCelular || aluguel.clienteTelefone || "")}
        </small>
      </td>
      <td><small>${escaparHTMLAluguel(resumoCurto)}</small></td>
      <td>${formatarDataAluguel(aluguel.dataInicio)}</td>
      <td>${formatarDataAluguel(aluguel.dataDevolucaoReal || aluguel.dataDevolucaoPrevista)}</td>
      <td>${obterTextoPeriodo(aluguel.periodo)}</td>
      <td>${valor}</td>
      <td>
        <span class="status-badge ${statusClass}">${statusText}</span>
        <small style="display:block; color:#666; margin-top:4px;">Pgto: ${escaparHTMLAluguel(pagamento)}</small>
      </td>
      <td>
        <div style="display:flex; gap:5px; flex-wrap:wrap;">
          <button type="button" class="btn btn-small btn-primary" onclick="visualizarAluguel('${aluguel.id}')" title="Visualizar">
            <i class="fas fa-eye"></i>
          </button>
          <button type="button" class="btn btn-small btn-success" onclick="imprimirAluguel('${aluguel.id}')" title="Imprimir">
            <i class="fas fa-print"></i>
          </button>
          <button
            type="button"
            class="btn btn-small btn-danger"
            onclick="abrirFechamentoAluguel('${aluguel.id}')"
            title="Finalizar/devolver"
            ${aluguel.status !== "ativo" ? "disabled" : ""}
          >
            <i class="fas fa-check"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function buscarAlugueis() {
  const termo = valorCampo("searchAlugueis").toLowerCase();
  const linhas = document.querySelectorAll("#alugueisList tr");

  linhas.forEach((linha) => {
    const texto = linha.textContent.toLowerCase();
    linha.style.display = texto.includes(termo) ? "" : "none";
  });
}

// ============================================
// FECHAMENTO / DEVOLUÇÃO
// ============================================

function configurarModalFechamento() {
  const modal = document.getElementById("modalFechamento");
  const btnCancelar = document.getElementById("btnCancelarFechamento");
  const btnConfirmar = document.getElementById("btnConfirmarFechamento");

  if (btnCancelar) {
    btnCancelar.addEventListener("click", fecharModalFechamento);
  }

  if (btnConfirmar) {
    btnConfirmar.addEventListener("click", confirmarFechamentoAluguel);
  }

  [
    "dataDevolucaoReal",
    "descontoFechamento",
    "acrescimoFechamento",
    "valorPagoFechamento",
  ].forEach((id) => {
    const campo = document.getElementById(id);
    if (campo) campo.addEventListener("input", recalcularFechamento);
  });

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        fecharModalFechamento();
      }
    });
  }
}

function abrirFechamentoAluguel(aluguelId) {
  const aluguel = alugueis.find((item) => item.id === aluguelId);

  if (!aluguel) {
    mostrarMensagemLocal("Erro", "Aluguel não encontrado.", "error");
    return;
  }

  aluguelEmFechamento = aluguel;

  preencherCampo("dataDevolucaoReal", dataHojeISO());
  preencherCampo("descontoFechamento", "0,00");
  preencherCampo("acrescimoFechamento", "0,00");
  preencherCampo("valorPagoFechamento", "");
  preencherCampo("formaPagamentoFechamento", "Dinheiro");
  preencherCampo("observacoesFechamento", "");

  setTexto("fechamentoCliente", aluguel.clienteNome || "");
  setTexto("fechamentoPeriodo", obterTextoPeriodo(aluguel.periodo));
  setTexto("fechamentoDataInicio", formatarDataAluguel(aluguel.dataInicio));

  renderizarItensFechamento();
  recalcularFechamento();

  const modal = document.getElementById("modalFechamento");
  if (modal) modal.style.display = "flex";
}

function fecharModalFechamento() {
  aluguelEmFechamento = null;

  const modal = document.getElementById("modalFechamento");
  if (modal) modal.style.display = "none";

  const lista = document.getElementById("fechamentoItens");
  if (lista) lista.innerHTML = "";
}

function renderizarItensFechamento() {
  const lista = document.getElementById("fechamentoItens");

  if (!lista || !aluguelEmFechamento) {
    return;
  }

  const equipamentos =
    aluguelEmFechamento.equipamentosDetalhes ||
    aluguelEmFechamento.equipamentos ||
    [];

  lista.innerHTML = equipamentos
    .map((item, index) => {
      const rotulo = obterRotuloUnidadeCobranca(item);
      const quantidadeCobrada = Number(
        item.quantidadeCobradaFinal ||
          item.quantidadeCobrada ||
          item.quantidadeCobradaPrevista ||
          item.quantidade ||
          1,
      );
      const valorUnitario = Number(
        item.valorUnitarioFinal || item.valorUnitario || 0,
      );

      return `
        <tr data-index="${index}">
          <td>
            <strong>${escaparHTMLAluguel(item.nomeEquipamento || item.nome)}</strong>
            <small style="display:block; color:#666;">
              Estoque reservado: ${item.quantidadeEstoque || item.quantidade || 0} unid.
            </small>
          </td>
          <td>
            <input
              type="text"
              class="fechamento-qtd-cobrada"
              value="${String(quantidadeCobrada).replace(".", ",")}"
              data-equipamento-id="${item.equipamentoId || item.id}"
              data-rotulo="${escaparHTMLAluguel(rotulo)}"
            >
            <small style="display:block; color:#666;">${escaparHTMLAluguel(rotulo)}</small>
          </td>
          <td>
            <input
              type="text"
              class="fechamento-valor-unitario"
              value="${formatarMoedaInput(valorUnitario)}"
              data-equipamento-id="${item.equipamentoId || item.id}"
            >
          </td>
          <td class="fechamento-subtotal-item">${formatarMoedaAluguel(0)}</td>
        </tr>
      `;
    })
    .join("");

  document
    .querySelectorAll(".fechamento-qtd-cobrada, .fechamento-valor-unitario")
    .forEach((campo) => {
      campo.addEventListener("input", recalcularFechamento);
    });
}

function obterItensFechamentoDaTela() {
  const linhas = document.querySelectorAll("#fechamentoItens tr");
  const itens = [];

  linhas.forEach((linha) => {
    const inputQuantidade = linha.querySelector(".fechamento-qtd-cobrada");
    const inputValor = linha.querySelector(".fechamento-valor-unitario");

    if (!inputQuantidade || !inputValor) {
      return;
    }

    itens.push({
      equipamentoId: inputQuantidade.dataset.equipamentoId,
      quantidadeCobradaFinal: parseNumeroBR(inputQuantidade.value),
      valorUnitarioFinal: parseNumeroBR(inputValor.value),
      linha,
    });
  });

  return itens;
}

function recalcularFechamento() {
  if (!aluguelEmFechamento) {
    return;
  }

  const dataDevolucaoReal = valorCampo("dataDevolucaoReal") || dataHojeISO();
  const duracaoReal = calcularDuracaoRealLocal(
    aluguelEmFechamento.dataInicio,
    dataDevolucaoReal,
    aluguelEmFechamento.periodo,
  );

  const itens = obterItensFechamentoDaTela();
  let subtotal = 0;

  itens.forEach((item) => {
    const subtotalItem =
      item.quantidadeCobradaFinal * item.valorUnitarioFinal * duracaoReal;
    subtotal += subtotalItem;

    const celulaSubtotal = item.linha.querySelector(
      ".fechamento-subtotal-item",
    );
    if (celulaSubtotal)
      celulaSubtotal.textContent = formatarMoedaAluguel(subtotalItem);
  });

  const desconto = parseNumeroBR(valorCampo("descontoFechamento"));
  const acrescimo = parseNumeroBR(valorCampo("acrescimoFechamento"));
  const valorTotal = Math.max(0, subtotal + acrescimo - desconto);
  const valorPagoTexto = valorCampo("valorPagoFechamento");
  const valorPago = valorPagoTexto ? parseNumeroBR(valorPagoTexto) : valorTotal;
  const saldo = Math.max(0, valorTotal - valorPago);

  setTexto(
    "duracaoRealTexto",
    obterRotuloDuracao(aluguelEmFechamento.periodo, duracaoReal),
  );
  setTexto("subtotalFinalTexto", formatarMoedaAluguel(subtotal));
  setTexto("valorTotalFinalTexto", formatarMoedaAluguel(valorTotal));
  setTexto("saldoFinalTexto", formatarMoedaAluguel(saldo));
}

async function confirmarFechamentoAluguel() {
  if (!aluguelEmFechamento) {
    mostrarMensagemLocal(
      "Erro",
      "Nenhum aluguel selecionado para fechamento.",
      "error",
    );
    return;
  }

  const dataDevolucaoReal = valorCampo("dataDevolucaoReal");

  if (!dataDevolucaoReal) {
    mostrarMensagemLocal("Erro", "Informe a data real de devolução.", "error");
    return;
  }

  const itens = obterItensFechamentoDaTela();

  for (const item of itens) {
    if (item.quantidadeCobradaFinal <= 0) {
      mostrarMensagemLocal(
        "Erro",
        "Todas as quantidades cobradas devem ser maiores que zero.",
        "error",
      );
      return;
    }

    if (item.valorUnitarioFinal <= 0) {
      mostrarMensagemLocal(
        "Erro",
        "Todos os valores unitários devem ser maiores que zero.",
        "error",
      );
      return;
    }
  }

  const confirmar = confirm(
    "Confirmar devolução e fechamento financeiro deste aluguel?\n\nEsta ação devolverá os equipamentos ao estoque.",
  );

  if (!confirmar) {
    return;
  }

  const btnConfirmar = document.getElementById("btnConfirmarFechamento");
  const textoOriginal = btnConfirmar ? btnConfirmar.innerHTML : "";

  if (btnConfirmar) {
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Finalizando...';
  }

  try {
    const valorPagoTexto = valorCampo("valorPagoFechamento");

    const fechamento = {
      dataDevolucaoReal,
      itensFechamento: itens.map((item) => ({
        equipamentoId: item.equipamentoId,
        quantidadeCobradaFinal: item.quantidadeCobradaFinal,
        valorUnitarioFinal: item.valorUnitarioFinal,
      })),
      desconto: parseNumeroBR(valorCampo("descontoFechamento")),
      acrescimo: parseNumeroBR(valorCampo("acrescimoFechamento")),
      formaPagamento: valorCampo("formaPagamentoFechamento"),
      observacoesFechamento: valorCampo("observacoesFechamento"),
    };

    if (valorPagoTexto) {
      fechamento.valorPago = parseNumeroBR(valorPagoTexto);
    }

    await AluguelService.finalizar(aluguelEmFechamento.id, fechamento);

    mostrarMensagemLocal(
      "Sucesso",
      "Aluguel finalizado, cobrança calculada e estoque devolvido!",
    );

    fecharModalFechamento();
    await carregarEquipamentosDisponiveis();
    await carregarAlugueis();
  } catch (error) {
    console.error("Erro ao finalizar aluguel:", error);
    mostrarMensagemLocal(
      "Erro",
      "Erro ao finalizar aluguel: " + error.message,
      "error",
    );
  } finally {
    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = textoOriginal;
    }
  }
}

// ============================================
// VISUALIZAÇÃO, IMPRESSÃO E LIMPEZA
// ============================================

function visualizarAluguel(aluguelId) {
  const aluguel = alugueis.find((item) => item.id === aluguelId);

  if (!aluguel) {
    mostrarMensagemLocal("Erro", "Aluguel não encontrado na lista.", "error");
    return;
  }

  const equipamentos =
    aluguel.equipamentosDetalhes || aluguel.equipamentos || [];
  const listaEquipamentos = equipamentos
    .map((item) => {
      const rotulo = obterRotuloUnidadeCobranca(item);
      const quantidadeEstoque = item.quantidadeEstoque || item.quantidade || 0;
      const quantidadeCobrada =
        item.quantidadeCobradaFinal ||
        item.quantidadeCobrada ||
        item.quantidade ||
        0;

      return `${quantidadeEstoque} unid. estoque | ${quantidadeCobrada} ${rotulo} — ${item.nomeEquipamento || item.nome}`;
    })
    .join("\n");

  const valorTexto =
    aluguel.status === "finalizado"
      ? formatarMoedaAluguel(aluguel.valorTotal || 0)
      : "A calcular na devolução";

  alert(
    `Cliente: ${aluguel.clienteNome}\n` +
      `Data de início: ${formatarDataAluguel(aluguel.dataInicio)}\n` +
      `Devolução prevista: ${formatarDataAluguel(aluguel.dataDevolucaoPrevista)}\n` +
      `Devolução real: ${formatarDataAluguel(aluguel.dataDevolucaoReal)}\n` +
      `Período: ${obterTextoPeriodo(aluguel.periodo)}\n` +
      `Valor: ${valorTexto}\n` +
      `Pagamento: ${aluguel.statusPagamento || "pendente"}\n\n` +
      `Equipamentos:\n${listaEquipamentos}`,
  );
}

function imprimirAluguel(aluguelId) {
  localStorage.setItem("aluguelParaImprimir", aluguelId);
  window.open("imprimir.html?id=" + aluguelId, "_blank");
}

function limparFormularioAluguel() {
  const form = document.getElementById("aluguelForm");

  if (form) {
    form.reset();
  }

  equipamentosSelecionados = [];
  clienteSelecionado = null;

  preencherCampo("dataInicio", dataHojeISO());
  preencherCampo("duracaoPrevista", 1);
  preencherCampo("subtotalPrevisto", formatarMoedaAluguel(0));
  preencherCampo("periodoTexto", "");
  preencherCampo("duracaoTexto", "");
  preencherCampo("dataDevolucaoPrevista", "");
  preencherCampo("valorPrevisto", formatarMoedaAluguel(0));

  limparInfoEquipamento();

  const infoCliente = document.getElementById("infoCliente");
  if (infoCliente) infoCliente.style.display = "none";

  const containerLista = document.getElementById("listaEquipamentosContainer");
  if (containerLista) containerLista.style.display = "none";

  const lista = document.getElementById("listaEquipamentos");
  if (lista) lista.innerHTML = "";

  const resumo = document.getElementById("resumoAluguel");
  if (resumo) resumo.style.display = "none";

  popularEquipamentosSelect();
}
