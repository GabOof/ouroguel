// Variáveis globais
let alugueis = [];
let equipamentosSelecionados = [];
let clienteSelecionado = null;

// Inicialização quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", function () {
  carregarClientesParaSelect("clienteSelect");
  carregarEquipamentosParaSelect("equipamentoSelect");
  carregarAlugueis();

  // Configurar formulário
  const form = document.getElementById("aluguelForm");
  if (form) {
    form.addEventListener("submit", registrarAluguel);
  }

  // Configurar data inicial para hoje
  const dataInicio = document.getElementById("dataInicio");
  if (dataInicio) {
    dataInicio.value = new Date().toISOString().split("T")[0];
    dataInicio.min = new Date().toISOString().split("T")[0];
  }

  // Verificar se há cliente pré-selecionado
  const clienteId = localStorage.getItem("clienteSelecionado");
  if (clienteId) {
    setTimeout(() => {
      document.getElementById("clienteSelect").value = clienteId;
      atualizarInfoCliente();
      localStorage.removeItem("clienteSelecionado");
    }, 1000);
  }

  // Verificar se há equipamento pré-selecionado
  const equipamentoId = localStorage.getItem("equipamentoSelecionado");
  if (equipamentoId) {
    setTimeout(() => {
      document.getElementById("equipamentoSelect").value = equipamentoId;
      atualizarInfoEquipamento();
      localStorage.removeItem("equipamentoSelecionado");
    }, 1500);
  }

  // Configurar botão de impressão
  const btnImprimir = document.getElementById("btnImprimir");
  if (btnImprimir) {
    btnImprimir.addEventListener("click", imprimirContrato);
  }
});

// Função para atualizar informações do cliente selecionado
async function atualizarInfoCliente() {
  const clienteSelect = document.getElementById("clienteSelect");
  const clienteId = clienteSelect.value;

  if (!clienteId) {
    document.getElementById("infoCliente").style.display = "none";
    return;
  }

  try {
    const cliente = await buscarClientePorId(clienteId);

    if (cliente) {
      document.getElementById("clienteTelefone").value = cliente.telefone || "";
      document.getElementById("clienteCelular").value = cliente.celular || "";
      document.getElementById("clienteCPF").value = cliente.cpf || "";
      document.getElementById("clienteCidade").value =
        `${cliente.cidade || ""}${cliente.estado ? "/" + cliente.estado : ""}`;
      document.getElementById("infoCliente").style.display = "block";
      clienteSelecionado = cliente;
    }
  } catch (error) {
    console.error("Erro ao carregar informações do cliente:", error);
  }
}

// Função para atualizar informações do equipamento selecionado
async function atualizarInfoEquipamento() {
  const equipamentoSelect = document.getElementById("equipamentoSelect");
  const equipamentoId = equipamentoSelect.value;

  if (!equipamentoId) {
    document.getElementById("infoEquipamento").style.display = "none";
    return;
  }

  try {
    const equipamento = await buscarEquipamentoPorId(equipamentoId);

    if (equipamento) {
      document.getElementById("equipamentoDisponivel").value =
        equipamento.quantidadeDisponivel || 0;
      document.getElementById("equipamentoValorHora").value = formatarMoeda(
        equipamento.valorHora || 0,
      );
      document.getElementById("equipamentoValorDia").value = formatarMoeda(
        equipamento.valorDia || 0,
      );
      document.getElementById("equipamentoValorMes").value = formatarMoeda(
        equipamento.valorMes || 0,
      );

      // Definir quantidade máxima disponível
      const quantidadeInput = document.getElementById("quantidadeAlugar");
      quantidadeInput.max = equipamento.quantidadeDisponivel || 1;
      quantidadeInput.value = 1;

      document.getElementById("infoEquipamento").style.display = "block";
    }
  } catch (error) {
    console.error("Erro ao carregar informações do equipamento:", error);
  }
}

// Função para adicionar equipamento à lista
function adicionarEquipamento() {
  const equipamentoSelect = document.getElementById("equipamentoSelect");
  const equipamentoId = equipamentoSelect.value;
  const quantidade =
    parseInt(document.getElementById("quantidadeAlugar").value) || 1;
  const periodo = document.getElementById("periodo").value;

  if (!equipamentoId) {
    mostrarMensagem("Atenção", "Selecione um equipamento primeiro", "warning");
    return;
  }

  if (!periodo) {
    mostrarMensagem(
      "Atenção",
      "Selecione o período (hora/dia/mês) primeiro",
      "warning",
    );
    return;
  }

  // Buscar informações do equipamento
  const option = equipamentoSelect.options[equipamentoSelect.selectedIndex];
  const equipamentoData = JSON.parse(option.dataset.equipamento);

  // Verificar se já está na lista
  const indexExistente = equipamentosSelecionados.findIndex(
    (item) => item.id === equipamentoId,
  );

  if (indexExistente >= 0) {
    // Atualizar quantidade
    equipamentosSelecionados[indexExistente].quantidade += quantidade;
  } else {
    // Adicionar novo
    equipamentosSelecionados.push({
      id: equipamentoId,
      nome: equipamentoData.nomeEquipamento,
      quantidade: quantidade,
      valorHora: equipamentoData.valorHora || 0,
      valorDia: equipamentoData.valorDia || 0,
      valorMes: equipamentoData.valorMes || 0,
    });
  }

  // Atualizar lista na tela
  atualizarListaEquipamentos();

  // Calcular valor
  calcularValor();

  // Limpar seleção
  equipamentoSelect.value = "";
  document.getElementById("infoEquipamento").style.display = "none";
  document.getElementById("quantidadeAlugar").value = 1;

  mostrarMensagem("Sucesso", "Equipamento adicionado à lista!");
}

// Função para atualizar lista de equipamentos na tela
function atualizarListaEquipamentos() {
  const lista = document.getElementById("listaEquipamentos");
  const container = document.getElementById("listaEquipamentosContainer");

  if (equipamentosSelecionados.length === 0) {
    container.style.display = "none";
    lista.innerHTML = "";
    return;
  }

  container.style.display = "block";

  let html = "";
  equipamentosSelecionados.forEach((item, index) => {
    const valorUnitario = getValorPorPeriodo(item);
    const subtotal = valorUnitario * item.quantidade;

    html += `
            <tr>
                <td>${item.nome}</td>
                <td>${item.quantidade}</td>
                <td>${formatarMoeda(valorUnitario)}</td>
                <td>${formatarMoeda(subtotal)}</td>
                <td>
                    <button class="btn btn-small btn-danger" onclick="removerEquipamento(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
  });

  lista.innerHTML = html;
}

// Função para remover equipamento da lista
function removerEquipamento(index) {
  equipamentosSelecionados.splice(index, 1);
  atualizarListaEquipamentos();
  calcularValor();
}

// Função para calcular valor por período
function getValorPorPeriodo(equipamento) {
  const periodo = document.getElementById("periodo").value;

  switch (periodo) {
    case "hora":
      return equipamento.valorHora;
    case "dia":
      return equipamento.valorDia;
    case "mes":
      return equipamento.valorMes;
    default:
      return 0;
  }
}

// Função para calcular valor total
function calcularValor() {
  const periodo = document.getElementById("periodo").value;
  const duracao = parseInt(document.getElementById("duracao").value) || 1;

  if (!periodo || equipamentosSelecionados.length === 0) {
    document.getElementById("resumoAluguel").style.display = "none";
    return;
  }

  let subtotal = 0;

  equipamentosSelecionados.forEach((item) => {
    const valorUnitario = getValorPorPeriodo(item);
    subtotal += valorUnitario * item.quantidade;
  });

  const valorTotal = subtotal * duracao;

  // Atualizar resumo
  document.getElementById("subtotal").value = formatarMoeda(subtotal);
  document.getElementById("periodoTexto").value =
    periodo === "hora" ? "Por Hora" : periodo === "dia" ? "Por Dia" : "Por Mês";
  document.getElementById("duracaoTexto").value =
    `${duracao} ${periodo}${duracao > 1 ? "s" : ""}`;
  document.getElementById("valorTotal").value = formatarMoeda(valorTotal);

  document.getElementById("resumoAluguel").style.display = "block";
  document.getElementById("btnImprimir").style.display = "inline-flex";
}

// Função para registrar aluguel
async function registrarAluguel(event) {
  event.preventDefault();

  // Validar dados
  const clienteId = document.getElementById("clienteSelect").value;
  const dataInicio = document.getElementById("dataInicio").value;
  const periodo = document.getElementById("periodo").value;
  const duracao = parseInt(document.getElementById("duracao").value) || 1;
  const observacoes = document
    .getElementById("observacoesAluguel")
    .value.trim();

  if (!clienteId) {
    mostrarMensagem("Erro", "Selecione um cliente", "error");
    return;
  }

  if (!dataInicio) {
    mostrarMensagem("Erro", "Informe a data de início", "error");
    return;
  }

  if (!periodo) {
    mostrarMensagem("Erro", "Selecione o período", "error");
    return;
  }

  if (equipamentosSelecionados.length === 0) {
    mostrarMensagem("Erro", "Adicione pelo menos um equipamento", "error");
    return;
  }

  // Calcular data de devolução
  const dataDevolucao = new Date(dataInicio);
  if (periodo === "hora") {
    dataDevolucao.setHours(dataDevolucao.getHours() + duracao);
  } else if (periodo === "dia") {
    dataDevolucao.setDate(dataDevolucao.getDate() + duracao);
  } else if (periodo === "mes") {
    dataDevolucao.setMonth(dataDevolucao.getMonth() + duracao);
  }

  try {
    // Preparar dados do aluguel
    const dadosAluguel = {
      clienteId: clienteId,
      clienteNome: clienteSelecionado?.nome || "",
      dataInicio: dataInicio,
      dataDevolucao: dataDevolucao.toISOString().split("T")[0],
      periodo: periodo,
      duracao: duracao,
      equipamentos: equipamentosSelecionados.map((item) => ({
        equipamentoId: item.id,
        nome: item.nome,
        quantidade: item.quantidade,
        valorUnitario: getValorPorPeriodo(item),
      })),
      subtotal: parseFloat(
        document
          .getElementById("subtotal")
          .value.replace("R$", "")
          .replace(".", "")
          .replace(",", ".") || 0,
      ),
      valorTotal: parseFloat(
        document
          .getElementById("valorTotal")
          .value.replace("R$", "")
          .replace(".", "")
          .replace(",", ".") || 0,
      ),
      observacoes: observacoes,
      status: "ativo",
      dataRegistro: new Date().toISOString(),
    };

    // Registrar aluguel
    const resultado = await db.collection("alugueis").add(dadosAluguel);

    // Atualizar estoque para cada equipamento
    for (const item of equipamentosSelecionados) {
      await atualizarEstoqueAposAluguel(item.id, item.quantidade);
    }

    mostrarMensagem("Sucesso", "Aluguel registrado com sucesso!");

    // Limpar formulário
    limparFormularioAluguel();

    // Recarregar lista
    carregarAlugueis();

    // Habilitar impressão do contrato específico
    document.getElementById("btnImprimir").dataset.aluguelId = resultado.id;
  } catch (error) {
    console.error("Erro ao registrar aluguel:", error);
    mostrarMensagem(
      "Erro",
      "Erro ao registrar aluguel: " + error.message,
      "error",
    );
  }
}

// Função para atualizar estoque após aluguel
async function atualizarEstoqueAposAluguel(equipamentoId, quantidade) {
  try {
    const equipamentoRef = db.collection("equipamentos").doc(equipamentoId);
    const equipamentoDoc = await equipamentoRef.get();

    if (equipamentoDoc.exists) {
      const equipamento = equipamentoDoc.data();
      const novaQuantidadeDisponivel =
        (equipamento.quantidadeDisponivel || 0) - quantidade;
      const novaQuantidadeAlugada =
        (equipamento.quantidadeAlugada || 0) + quantidade;

      await equipamentoRef.update({
        quantidadeDisponivel: Math.max(0, novaQuantidadeDisponivel),
        quantidadeAlugada: novaQuantidadeAlugada,
      });
    }
  } catch (error) {
    console.error("Erro ao atualizar estoque:", error);
  }
}

// Função para carregar aluguéis
async function carregarAlugueis() {
  try {
    const alugueisList = document.getElementById("alugueisList");
    if (!alugueisList) return;

    // Mostrar indicador de carregamento
    alugueisList.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
                    <p>Carregando aluguéis...</p>
                </td>
            </tr>
        `;

    // Buscar aluguéis no Firestore
    const snapshot = await db
      .collection("alugueis")
      .orderBy("dataRegistro", "desc")
      .get();

    if (snapshot.empty) {
      alugueisList.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-message">
                        <i class="fas fa-file-contract"></i>
                        <p>Nenhum aluguel registrado ainda</p>
                    </td>
                </tr>
            `;
      alugueis = [];
      return;
    }

    // Limpar array
    alugueis = [];

    // Construir HTML da lista
    let html = "";
    snapshot.forEach((doc) => {
      const aluguel = {
        id: doc.id,
        ...doc.data(),
      };
      alugueis.push(aluguel);

      // Formatar lista de equipamentos
      const equipamentosLista =
        aluguel.equipamentos
          ?.map((e) => `${e.quantidade}x ${e.nome}`)
          .join(", ") || "";

      // Status
      let statusClass = "status-available";
      let statusText = "Ativo";

      if (aluguel.status === "finalizado") {
        statusClass = "status-success";
        statusText = "Finalizado";
      } else if (aluguel.status === "cancelado") {
        statusClass = "status-unavailable";
        statusText = "Cancelado";
      } else if (new Date(aluguel.dataDevolucao) < new Date()) {
        statusClass = "status-warning";
        statusText = "Atrasado";
      }

      html += `
                <tr>
                    <td>
                        <strong>${aluguel.clienteNome || ""}</strong>
                        <br><small>${formatarData(aluguel.dataInicio)}</small>
                    </td>
                    <td>
                        <small>${equipamentosLista.substring(0, 50)}${equipamentosLista.length > 50 ? "..." : ""}</small>
                    </td>
                    <td>${formatarData(aluguel.dataInicio)}</td>
                    <td>${
                      aluguel.periodo === "hora"
                        ? "Por Hora"
                        : aluguel.periodo === "dia"
                          ? "Por Dia"
                          : "Por Mês"
                    }</td>
                    <td>${formatarMoeda(aluguel.valorTotal || 0)}</td>
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
                            <button class="btn btn-small btn-danger" onclick="finalizarAluguel('${aluguel.id}')" ${aluguel.status === "finalizado" ? "disabled" : ""}>
                                <i class="fas fa-check"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    alugueisList.innerHTML = html;
  } catch (error) {
    console.error("Erro ao carregar aluguéis:", error);
    alugueisList.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar aluguéis</p>
                </td>
            </tr>
        `;
  }
}

// Função para buscar aluguéis
function buscarAlugueis() {
  const termo = document.getElementById("searchAlugueis").value.toLowerCase();
  const linhas = document.querySelectorAll("#alugueisList tr");

  linhas.forEach((linha) => {
    const textoLinha = linha.textContent.toLowerCase();
    if (textoLinha.includes(termo)) {
      linha.style.display = "";
    } else {
      linha.style.display = "none";
    }
  });
}

// Função para visualizar aluguel
function visualizarAluguel(aluguelId) {
  alert("Funcionalidade de visualização detalhada será implementada!");
  // Aqui você pode implementar um modal com detalhes completos
}

// Função para imprimir aluguel específico
function imprimirAluguel(aluguelId) {
  localStorage.setItem("aluguelParaImprimir", aluguelId);
  window.open("imprimir.html", "_blank");
}

// Função para finalizar aluguel
async function finalizarAluguel(aluguelId) {
  if (
    !confirm(
      "Tem certeza que deseja finalizar este aluguel?\n\nEsta ação devolverá os equipamentos ao estoque.",
    )
  ) {
    return;
  }

  try {
    const aluguelRef = db.collection("alugueis").doc(aluguelId);
    const aluguelDoc = await aluguelRef.get();

    if (aluguelDoc.exists) {
      const aluguel = aluguelDoc.data();

      // Atualizar status
      await aluguelRef.update({
        status: "finalizado",
        dataDevolucaoReal: new Date().toISOString().split("T")[0],
      });

      // Devolver equipamentos ao estoque
      for (const item of aluguel.equipamentos || []) {
        await devolverEquipamentoAoEstoque(item.equipamentoId, item.quantidade);
      }

      mostrarMensagem("Sucesso", "Aluguel finalizado com sucesso!");
      carregarAlugueis();
    }
  } catch (error) {
    console.error("Erro ao finalizar aluguel:", error);
    mostrarMensagem(
      "Erro",
      "Erro ao finalizar aluguel: " + error.message,
      "error",
    );
  }
}

// Função para devolver equipamento ao estoque
async function devolverEquipamentoAoEstoque(equipamentoId, quantidade) {
  try {
    const equipamentoRef = db.collection("equipamentos").doc(equipamentoId);
    const equipamentoDoc = await equipamentoRef.get();

    if (equipamentoDoc.exists) {
      const equipamento = equipamentoDoc.data();
      const novaQuantidadeDisponivel =
        (equipamento.quantidadeDisponivel || 0) + quantidade;
      const novaQuantidadeAlugada = Math.max(
        0,
        (equipamento.quantidadeAlugada || 0) - quantidade,
      );

      await equipamentoRef.update({
        quantidadeDisponivel: novaQuantidadeDisponivel,
        quantidadeAlugada: novaQuantidadeAlugada,
      });
    }
  } catch (error) {
    console.error("Erro ao devolver equipamento:", error);
  }
}

// Função para imprimir contrato atual
function imprimirContrato() {
  const aluguelId = document.getElementById("btnImprimir").dataset.aluguelId;
  if (aluguelId) {
    imprimirAluguel(aluguelId);
  } else {
    alert("Registre um aluguel primeiro para poder imprimir o contrato.");
  }
}

// Função para limpar formulário
function limparFormularioAluguel() {
  document.getElementById("aluguelForm").reset();
  equipamentosSelecionados = [];
  clienteSelecionado = null;

  // Resetar datas
  document.getElementById("dataInicio").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("duracao").value = 1;

  // Ocultar seções
  document.getElementById("infoCliente").style.display = "none";
  document.getElementById("infoEquipamento").style.display = "none";
  document.getElementById("listaEquipamentosContainer").style.display = "none";
  document.getElementById("resumoAluguel").style.display = "none";
  document.getElementById("btnImprimir").style.display = "none";

  // Limpar lista
  document.getElementById("listaEquipamentos").innerHTML = "";

  // Recarregar selects
  carregarClientesParaSelect("clienteSelect");
  carregarEquipamentosParaSelect("equipamentoSelect");
}
