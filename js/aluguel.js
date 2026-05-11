let alugueis = [];
let equipamentosSelecionados = [];
let clienteSelecionado = null;

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function aguardarFirebaseAluguel() {
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

function calcularDataDevolucao(dataInicio, periodo, duracao) {
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
  const periodo = valorCampo("periodo");
  const duracao = parseInt(valorCampo("duracao"), 10) || 1;

  let subtotal = 0;

  equipamentosSelecionados.forEach((item) => {
    subtotal += getValorPorPeriodo(item) * item.quantidade;
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

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await aguardarFirebaseAluguel();

    configurarFormularioAluguel();

    await carregarClientesParaSelect("clienteSelect");
    await carregarEquipamentosParaSelect("equipamentoSelect");
    await carregarAlugueis();

    await aplicarPreSelecoes();
  } catch (error) {
    console.error("Erro ao inicializar tela de aluguel:", error);

    mostrarMensagem(
      "Erro",
      "Não foi possível inicializar a tela de aluguéis.",
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
  } else {
    const nomeEquipamento =
      equipamentoData.nomeEquipamento || equipamentoData.nome || "Equipamento";

    equipamentosSelecionados.push({
      id: equipamentoId,
      equipamentoId,
      nome: nomeEquipamento,
      nomeEquipamento,
      quantidade,
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
      const subtotal = valorUnitario * item.quantidade;

      return `
        <tr>
          <td>${escaparHTMLAluguel(item.nomeEquipamento)}</td>
          <td>${item.quantidade}</td>
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
// REGISTRO TRANSACIONAL DE ALUGUEL
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
    const db = await aguardarFirebaseAluguel();

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

    const dataDevolucao = calcularDataDevolucao(dataInicio, periodo, duracao);
    const aluguelRef = db.collection("alugueis").doc();

    await db.runTransaction(async function (transaction) {
      const equipamentoRefs = equipamentosSelecionados.map((item) =>
        db.collection("equipamentos").doc(item.id),
      );

      const equipamentoDocs = [];

      for (const ref of equipamentoRefs) {
        equipamentoDocs.push(await transaction.get(ref));
      }

      const equipamentosDetalhes = [];
      let subtotal = 0;

      for (let i = 0; i < equipamentosSelecionados.length; i++) {
        const itemSelecionado = equipamentosSelecionados[i];
        const equipamentoDoc = equipamentoDocs[i];

        if (!equipamentoDoc.exists) {
          throw new Error(
            `Equipamento ${itemSelecionado.nomeEquipamento} não encontrado.`,
          );
        }

        const equipamentoAtual = equipamentoDoc.data();

        if (equipamentoAtual.status !== "disponivel") {
          throw new Error(
            `Equipamento "${equipamentoAtual.nomeEquipamento}" não está disponível para aluguel.`,
          );
        }

        const quantidadeDisponivel = Number(
          equipamentoAtual.quantidadeDisponivel || 0,
        );
        const quantidadeAlugada = Number(
          equipamentoAtual.quantidadeAlugada || 0,
        );
        const quantidadeSolicitada = Number(itemSelecionado.quantidade || 0);

        if (quantidadeSolicitada > quantidadeDisponivel) {
          throw new Error(
            `Estoque insuficiente para "${equipamentoAtual.nomeEquipamento}". Disponível: ${quantidadeDisponivel}.`,
          );
        }

        const valorUnitario = obterValorPorPeriodoDoObjeto(
          equipamentoAtual,
          periodo,
        );

        if (valorUnitario <= 0) {
          throw new Error(
            `Valor do período não configurado para "${equipamentoAtual.nomeEquipamento}".`,
          );
        }

        subtotal += valorUnitario * quantidadeSolicitada;

        equipamentosDetalhes.push({
          equipamentoId: itemSelecionado.id,
          nome:
            equipamentoAtual.nomeEquipamento || itemSelecionado.nomeEquipamento,
          nomeEquipamento:
            equipamentoAtual.nomeEquipamento || itemSelecionado.nomeEquipamento,
          quantidade: quantidadeSolicitada,
          valorUnitario,
          valorHora: Number(equipamentoAtual.valorHora || 0),
          valorDia: Number(equipamentoAtual.valorDia || 0),
          valorMes: Number(equipamentoAtual.valorMes || 0),
        });

        transaction.update(equipamentoRefs[i], {
          quantidadeDisponivel: quantidadeDisponivel - quantidadeSolicitada,
          quantidadeAlugada: quantidadeAlugada + quantidadeSolicitada,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      const valorTotal = subtotal * duracao;

      transaction.set(aluguelRef, {
        clienteId,
        clienteNome: clienteSelecionado.nome || "",
        clienteCpf: clienteSelecionado.cpf || "",
        clienteCelular: clienteSelecionado.celular || "",

        dataInicio,
        dataDevolucao,
        periodo,
        duracao,

        equipamentosIds: equipamentosDetalhes.map((item) => item.equipamentoId),
        equipamentos: equipamentosDetalhes,
        equipamentosDetalhes,

        subtotal,
        valorTotal,
        observacoes,

        status: "ativo",
        dataRegistro: new Date().toISOString(),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        criadoPor: window.auth?.currentUser?.uid || null,
      });
    });

    mostrarMensagem("Sucesso", "Aluguel registrado com sucesso!");

    limparFormularioAluguel();
    await carregarAlugueis();

    const btnImprimir = document.getElementById("btnImprimir");

    if (btnImprimir) {
      btnImprimir.dataset.aluguelId = aluguelRef.id;
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
    const db = await aguardarFirebaseAluguel();

    alugueisList.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando aluguéis...</p>
        </td>
      </tr>
    `;

    const snapshot = await db
      .collection("alugueis")
      .orderBy("dataRegistro", "desc")
      .get();

    alugueis = [];

    if (snapshot.empty) {
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

    snapshot.forEach((doc) => {
      alugueis.push({
        id: doc.id,
        ...doc.data(),
      });
    });

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

            <td>${formatarMoedaAluguel(aluguel.valorTotal || 0)}</td>

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
// FINALIZAÇÃO TRANSACIONAL DE ALUGUEL
// ============================================

async function finalizarAluguel(aluguelId) {
  const confirmar = confirm(
    "Tem certeza que deseja finalizar este aluguel?\n\nEsta ação devolverá os equipamentos ao estoque.",
  );

  if (!confirmar) {
    return;
  }

  try {
    const db = await aguardarFirebaseAluguel();

    const aluguelRef = db.collection("alugueis").doc(aluguelId);

    await db.runTransaction(async function (transaction) {
      const aluguelDoc = await transaction.get(aluguelRef);

      if (!aluguelDoc.exists) {
        throw new Error("Aluguel não encontrado.");
      }

      const aluguel = aluguelDoc.data();

      if (aluguel.status === "finalizado") {
        throw new Error("Este aluguel já está finalizado.");
      }

      if (aluguel.status === "cancelado") {
        throw new Error("Este aluguel está cancelado.");
      }

      const equipamentos =
        aluguel.equipamentosDetalhes || aluguel.equipamentos || [];

      const equipamentoRefs = equipamentos.map((item) =>
        db.collection("equipamentos").doc(item.equipamentoId || item.id),
      );

      const equipamentoDocs = [];

      for (const ref of equipamentoRefs) {
        equipamentoDocs.push(await transaction.get(ref));
      }

      transaction.update(aluguelRef, {
        status: "finalizado",
        dataDevolucaoReal: dataHojeISO(),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      for (let i = 0; i < equipamentos.length; i++) {
        const item = equipamentos[i];
        const equipamentoDoc = equipamentoDocs[i];

        if (!equipamentoDoc.exists) {
          throw new Error(`Equipamento relacionado ao aluguel não encontrado.`);
        }

        const equipamento = equipamentoDoc.data();

        const quantidade = Number(item.quantidade || 0);
        const quantidadeTotal = Number(equipamento.quantidadeTotal || 0);
        const quantidadeDisponivel = Number(
          equipamento.quantidadeDisponivel || 0,
        );
        const quantidadeAlugada = Number(equipamento.quantidadeAlugada || 0);

        transaction.update(equipamentoRefs[i], {
          quantidadeDisponivel: Math.min(
            quantidadeTotal,
            quantidadeDisponivel + quantidade,
          ),
          quantidadeAlugada: Math.max(0, quantidadeAlugada - quantidade),
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    mostrarMensagem("Sucesso", "Aluguel finalizado com sucesso!");
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
// IMPRESSÃO E LIMPEZA
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
