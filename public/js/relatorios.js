// Variáveis para os gráficos
let chartAlugueisDia = null;
let chartFaturamentoCategoria = null;
let chartTopClientes = null;
let chartTopEquipamentos = null;

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  // Configurar datas padrão
  const hoje = new Date();
  document.getElementById("dataInicio").value = hoje
    .toISOString()
    .split("T")[0];
  document.getElementById("dataFim").value = hoje.toISOString().split("T")[0];

  // Atualizar relatórios inicialmente
  atualizarRelatorios();

  // Configurar evento para período personalizado
  document.getElementById("periodo").addEventListener("change", function () {
    const isPersonalizado = this.value === "personalizado";
    document.getElementById("dataInicioContainer").style.display =
      isPersonalizado ? "block" : "none";
    document.getElementById("dataFimContainer").style.display = isPersonalizado
      ? "block"
      : "none";
  });
});

// Função para obter datas baseado no período selecionado
function getDatesFromPeriod() {
  const periodo = document.getElementById("periodo").value;
  const hoje = new Date();

  let dataInicio, dataFim;

  switch (periodo) {
    case "hoje":
      dataInicio = new Date(hoje);
      dataFim = new Date(hoje);
      break;

    case "semana":
      dataInicio = new Date(hoje);
      dataInicio.setDate(hoje.getDate() - 7);
      dataFim = new Date(hoje);
      break;

    case "mes":
      dataInicio = new Date(hoje);
      dataInicio.setMonth(hoje.getMonth() - 1);
      dataFim = new Date(hoje);
      break;

    case "trimestre":
      dataInicio = new Date(hoje);
      dataInicio.setMonth(hoje.getMonth() - 3);
      dataFim = new Date(hoje);
      break;

    case "ano":
      dataInicio = new Date(hoje);
      dataInicio.setFullYear(hoje.getFullYear() - 1);
      dataFim = new Date(hoje);
      break;

    case "personalizado":
      const inicioInput = document.getElementById("dataInicio").value;
      const fimInput = document.getElementById("dataFim").value;
      dataInicio = new Date(inicioInput);
      dataFim = new Date(fimInput);
      break;
  }

  return { dataInicio, dataFim };
}

// Função principal para atualizar todos os relatórios
async function atualizarRelatorios() {
  try {
    // Mostrar indicador de carregamento
    mostrarCarregamento();

    const { dataInicio, dataFim } = getDatesFromPeriod();

    // Carregar todos os dados em paralelo
    const [alugueis, clientes, equipamentos, resumo] = await Promise.all([
      carregarAlugueisPeriodo(dataInicio, dataFim),
      carregarClientesPeriodo(dataInicio, dataFim),
      carregarEquipamentosPeriodo(dataInicio, dataFim),
      carregarResumoPeriodo(dataInicio, dataFim),
    ]);

    // Atualizar cards de resumo
    atualizarCardsResumo(resumo);

    // Atualizar gráficos
    atualizarGraficos(alugueis, clientes, equipamentos);

    // Atualizar tabelas
    atualizarTabelas(alugueis, clientes, equipamentos);
  } catch (error) {
    console.error("Erro ao atualizar relatórios:", error);
    mostrarMensagem("Erro", "Não foi possível carregar os relatórios", "error");
  } finally {
    esconderCarregamento();
  }
}

// Função para mostrar indicador de carregamento
function mostrarCarregamento() {
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "loading-overlay";
  loadingDiv.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Carregando relatórios...</p>
        </div>
    `;
  loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;

  document.body.appendChild(loadingDiv);
}

// Função para esconder indicador de carregamento
function esconderCarregamento() {
  const loadingDiv = document.getElementById("loading-overlay");
  if (loadingDiv) loadingDiv.remove();
}

// Função para carregar aluguéis do período
async function carregarAlugueisPeriodo(dataInicio, dataFim) {
  try {
    // Converter para timestamp do Firestore
    const inicioTimestamp = firebase.firestore.Timestamp.fromDate(dataInicio);
    const fimTimestamp = firebase.firestore.Timestamp.fromDate(
      new Date(dataFim.getTime() + 86400000),
    ); // +1 dia

    const snapshot = await db
      .collection("alugueis")
      .where("dataRegistro", ">=", inicioTimestamp)
      .where("dataRegistro", "<=", fimTimestamp)
      .orderBy("dataRegistro", "desc")
      .get();

    const alugueis = [];
    snapshot.forEach((doc) => {
      alugueis.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return alugueis;
  } catch (error) {
    console.error("Erro ao carregar aluguéis:", error);
    return [];
  }
}

// Função para carregar clientes do período
async function carregarClientesPeriodo(dataInicio, dataFim) {
  try {
    // Buscar todos os clientes
    const snapshot = await db.collection("clientes").get();

    const clientes = [];
    snapshot.forEach((doc) => {
      clientes.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return clientes;
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    return [];
  }
}

// Função para carregar equipamentos do período
async function carregarEquipamentosPeriodo(dataInicio, dataFim) {
  try {
    // Buscar todos os equipamentos
    const snapshot = await db.collection("equipamentos").get();

    const equipamentos = [];
    snapshot.forEach((doc) => {
      equipamentos.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return equipamentos;
  } catch (error) {
    console.error("Erro ao carregar equipamentos:", error);
    return [];
  }
}

// Função para carregar resumo do período
async function carregarResumoPeriodo(dataInicio, dataFim) {
  const alugueis = await carregarAlugueisPeriodo(dataInicio, dataFim);
  const clientes = await carregarClientesPeriodo(dataInicio, dataFim);
  const equipamentos = await carregarEquipamentosPeriodo(dataInicio, dataFim);

  // Calcular métricas
  const totalAlugueis = alugueis.length;
  const faturamentoTotal = alugueis.reduce(
    (total, aluguel) => total + (aluguel.valorTotal || 0),
    0,
  );

  // Novos clientes (criados no período)
  const inicioTimestamp = firebase.firestore.Timestamp.fromDate(dataInicio);
  const clientesSnapshot = await db
    .collection("clientes")
    .where("dataCadastro", ">=", inicioTimestamp)
    .get();
  const novosClientes = clientesSnapshot.size;

  // Equipamentos ativos (com aluguéis no período)
  const equipamentosAtivos = new Set();
  alugueis.forEach((aluguel) => {
    aluguel.equipamentos?.forEach((item) => {
      equipamentosAtivos.add(item.equipamentoId);
    });
  });

  return {
    totalAlugueis,
    faturamentoTotal,
    novosClientes,
    equipamentosAtivos: equipamentosAtivos.size,
    alugueis,
    clientes,
    equipamentos,
  };
}

// Função para atualizar cards de resumo
function atualizarCardsResumo(resumo) {
  document.getElementById("totalAlugueis").textContent = resumo.totalAlugueis;
  document.getElementById("faturamentoTotal").textContent = formatarMoeda(
    resumo.faturamentoTotal,
  );
  document.getElementById("novosClientes").textContent = resumo.novosClientes;
  document.getElementById("equipamentosAtivos").textContent =
    resumo.equipamentosAtivos;
}

// Função para atualizar gráficos
function atualizarGraficos(alugueis, clientes, equipamentos) {
  // Destruir gráficos existentes
  if (chartAlugueisDia) chartAlugueisDia.destroy();
  if (chartFaturamentoCategoria) chartFaturamentoCategoria.destroy();
  if (chartTopClientes) chartTopClientes.destroy();
  if (chartTopEquipamentos) chartTopEquipamentos.destroy();

  // 1. Gráfico de aluguéis por dia
  const alugueisPorDia = calcularAlugueisPorDia(alugueis);
  chartAlugueisDia = criarGraficoLinha(
    "chartAlugueisDia",
    Object.keys(alugueisPorDia),
    Object.values(alugueisPorDia),
    "Aluguéis por Dia",
    "#3498db",
  );

  // 2. Gráfico de faturamento por categoria
  const faturamentoPorCategoria = calcularFaturamentoPorCategoria(
    alugueis,
    equipamentos,
  );
  chartFaturamentoCategoria = criarGraficoPizza(
    "chartFaturamentoCategoria",
    Object.keys(faturamentoPorCategoria),
    Object.values(faturamentoPorCategoria),
    "Faturamento por Categoria",
  );

  // 3. Gráfico de top clientes
  const topClientes = calcularTopClientes(alugueis);
  chartTopClientes = criarGraficoBarras(
    "chartTopClientes",
    topClientes.map((c) => c.nome),
    topClientes.map((c) => c.total),
    "Top 5 Clientes",
    "#2ecc71",
  );

  // 4. Gráfico de equipamentos mais alugados
  const topEquipamentos = calcularTopEquipamentos(alugueis);
  chartTopEquipamentos = criarGraficoBarras(
    "chartTopEquipamentos",
    topEquipamentos.map((e) => e.nome),
    topEquipamentos.map((e) => e.quantidade),
    "Equipamentos Mais Alugados",
    "#e74c3c",
  );
}

// Função para criar gráfico de linha
function criarGraficoLinha(canvasId, labels, data, label, color) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: label,
          data: data,
          borderColor: color,
          backgroundColor: color + "20",
          borderWidth: 2,
          tension: 0.1,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  });
}

// Função para criar gráfico de pizza
function criarGraficoPizza(canvasId, labels, data, label) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const colors = [
    "#3498db",
    "#2ecc71",
    "#e74c3c",
    "#f39c12",
    "#9b59b6",
    "#1abc9c",
    "#d35400",
    "#34495e",
  ];

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [
        {
          label: label,
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
        },
      },
    },
  });
}

// Função para criar gráfico de barras
function criarGraficoBarras(canvasId, labels, data, label, color) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: label,
          data: data,
          backgroundColor: color,
          borderColor: color,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

// Função para calcular aluguéis por dia
function calcularAlugueisPorDia(alugueis) {
  const alugueisPorDia = {};

  alugueis.forEach((aluguel) => {
    const data = formatarData(aluguel.dataInicio || aluguel.dataRegistro);
    alugueisPorDia[data] = (alugueisPorDia[data] || 0) + 1;
  });

  // Ordenar por data
  const sorted = {};
  Object.keys(alugueisPorDia)
    .sort()
    .forEach((key) => {
      sorted[key] = alugueisPorDia[key];
    });

  return sorted;
}

// Função para calcular faturamento por categoria
async function calcularFaturamentoPorCategoria(alugueis, equipamentos) {
  const faturamentoPorCategoria = {};
  const equipamentosMap = {};

  // Criar mapa de equipamentos para fácil acesso
  equipamentos.forEach((eq) => {
    equipamentosMap[eq.id] = eq;
  });

  // Calcular faturamento por categoria
  alugueis.forEach((aluguel) => {
    aluguel.equipamentos?.forEach((item) => {
      const equipamento = equipamentosMap[item.equipamentoId];
      if (equipamento) {
        const categoria = equipamento.categoria || "Outros";
        const valor =
          (item.valorUnitario || 0) *
          (item.quantidade || 0) *
          (aluguel.duracao || 1);

        faturamentoPorCategoria[categoria] =
          (faturamentoPorCategoria[categoria] || 0) + valor;
      }
    });
  });

  return faturamentoPorCategoria;
}

// Função para calcular top clientes
async function calcularTopClientes(alugueis) {
  const clientesMap = {};
  const clientesInfo = {};

  // Agrupar aluguéis por cliente
  for (const aluguel of alugueis) {
    if (!aluguel.clienteId) continue;

    // Buscar informações do cliente
    if (!clientesInfo[aluguel.clienteId]) {
      try {
        const clienteDoc = await db
          .collection("clientes")
          .doc(aluguel.clienteId)
          .get();
        if (clienteDoc.exists) {
          clientesInfo[aluguel.clienteId] =
            clienteDoc.data().nome || "Cliente Desconhecido";
        }
      } catch (error) {
        console.error("Erro ao buscar cliente:", error);
      }
    }

    const nome =
      clientesInfo[aluguel.clienteId] ||
      "Cliente " + aluguel.clienteId.substring(0, 8);
    const valor = aluguel.valorTotal || 0;

    if (!clientesMap[aluguel.clienteId]) {
      clientesMap[aluguel.clienteId] = {
        id: aluguel.clienteId,
        nome: nome,
        total: 0,
        quantidade: 0,
      };
    }

    clientesMap[aluguel.clienteId].total += valor;
    clientesMap[aluguel.clienteId].quantidade += 1;
  }

  // Converter para array e ordenar
  const clientesArray = Object.values(clientesMap);
  clientesArray.sort((a, b) => b.total - a.total);

  return clientesArray.slice(0, 5);
}

// Função para calcular top equipamentos
async function calcularTopEquipamentos(alugueis) {
  const equipamentosMap = {};
  const equipamentosInfo = {};

  // Agrupar aluguéis por equipamento
  for (const aluguel of alugueis) {
    aluguel.equipamentos?.forEach((item) => {
      const equipamentoId = item.equipamentoId;

      if (!equipamentosMap[equipamentoId]) {
        equipamentosMap[equipamentoId] = {
          id: equipamentoId,
          nome: "Carregando...",
          quantidade: 0,
          faturamento: 0,
        };
      }

      equipamentosMap[equipamentoId].quantidade += item.quantidade || 0;
      equipamentosMap[equipamentoId].faturamento +=
        (item.valorUnitario || 0) *
        (item.quantidade || 0) *
        (aluguel.duracao || 1);

      // Buscar nome do equipamento
      if (!equipamentosInfo[equipamentoId]) {
        db.collection("equipamentos")
          .doc(equipamentoId)
          .get()
          .then((doc) => {
            if (doc.exists) {
              equipamentosMap[equipamentoId].nome =
                doc.data().nomeEquipamento || "Equipamento Desconhecido";
            }
          })
          .catch((error) => {
            console.error("Erro ao buscar equipamento:", error);
          });
      }
    });
  }

  // Converter para array e ordenar
  const equipamentosArray = Object.values(equipamentosMap);
  equipamentosArray.sort((a, b) => b.quantidade - a.quantidade);

  return equipamentosArray.slice(0, 5);
}

// Função para atualizar tabelas
function atualizarTabelas(alugueis, clientes, equipamentos) {
  const tipoRelatorio = document.getElementById("tipoRelatorio").value;

  switch (tipoRelatorio) {
    case "alugueis":
      atualizarTabelaAlugueis(alugueis);
      openTab("alugueisTab");
      break;
    case "clientes":
      atualizarTabelaClientes(alugueis);
      openTab("clientesTab");
      break;
    case "equipamentos":
      atualizarTabelaEquipamentos(alugueis, equipamentos);
      openTab("equipamentosTab");
      break;
    case "financeiro":
      atualizarTabelaFinanceiro(alugueis);
      openTab("financeiroTab");
      break;
    default:
      atualizarTabelaAlugueis(alugueis);
      openTab("alugueisTab");
  }
}

// Função para abrir aba
function openTab(tabName) {
  // Remover classe active de todas as abas
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // Adicionar classe active à aba selecionada
  document
    .querySelector(`[onclick="openTab('${tabName}')"]`)
    .classList.add("active");
  document.getElementById(tabName).classList.add("active");
}

// Função para atualizar tabela de aluguéis
async function atualizarTabelaAlugueis(alugueis) {
  const tbody = document.getElementById("tabelaAlugueis");

  if (alugueis.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum aluguel encontrado no período</p>
                </td>
            </tr>
        `;
    return;
  }

  let html = "";

  for (const aluguel of alugueis.slice(0, 50)) {
    // Limitar a 50 registros
    // Buscar nome do cliente
    let clienteNome = "Carregando...";
    try {
      const clienteDoc = await db
        .collection("clientes")
        .doc(aluguel.clienteId)
        .get();
      if (clienteDoc.exists) {
        clienteNome = clienteDoc.data().nome || "Cliente Desconhecido";
      }
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
    }

    // Formatar equipamentos
    const equipamentosStr =
      aluguel.equipamentos
        ?.map((e) => `${e.quantidade}x ${e.nome}`)
        .join(", ") || "";

    html += `
            <tr>
                <td>${formatarData(aluguel.dataInicio)}</td>
                <td>${clienteNome}</td>
                <td><small>${equipamentosStr.substring(0, 50)}${equipamentosStr.length > 50 ? "..." : ""}</small></td>
                <td>${formatarMoeda(aluguel.valorTotal || 0)}</td>
                <td>
                    <span class="status-badge ${aluguel.status === "ativo" ? "status-available" : "status-success"}">
                        ${aluguel.status === "ativo" ? "Ativo" : "Finalizado"}
                    </span>
                </td>
            </tr>
        `;
  }

  tbody.innerHTML = html;
}

// Função para atualizar tabela de clientes (simplificada)
async function atualizarTabelaClientes(alugueis) {
  const topClientes = await calcularTopClientes(alugueis);
  const tbody = document.getElementById("tabelaClientes");

  if (topClientes.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">
                    <i class="fas fa-users"></i>
                    <p>Nenhum cliente com aluguéis no período</p>
                </td>
            </tr>
        `;
    return;
  }

  let html = "";

  for (const cliente of topClientes) {
    html += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.quantidade}</td>
                <td>${formatarMoeda(cliente.total)}</td>
                <td>${formatarData(new Date())}</td>
            </tr>
        `;
  }

  tbody.innerHTML = html;
}

// Função para atualizar tabela de equipamentos (simplificada)
async function atualizarTabelaEquipamentos(alugueis, equipamentos) {
  const topEquipamentos = await calcularTopEquipamentos(alugueis);
  const tbody = document.getElementById("tabelaEquipamentos");

  if (topEquipamentos.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">
                    <i class="fas fa-box"></i>
                    <p>Nenhum equipamento alugado no período</p>
                </td>
            </tr>
        `;
    return;
  }

  let html = "";

  for (const equipamento of topEquipamentos) {
    // Calcular taxa de uso (alugueis / dias no período)
    const diasPeriodo = 7; // Exemplo: última semana
    const taxaUso = (
      ((equipamento.quantidade || 0) / diasPeriodo) *
      100
    ).toFixed(1);

    html += `
            <tr>
                <td>${equipamento.nome}</td>
                <td>${equipamento.quantidade}</td>
                <td>${formatarMoeda(equipamento.faturamento)}</td>
                <td>${taxaUso}%</td>
            </tr>
        `;
  }

  tbody.innerHTML = html;
}

// Função para atualizar tabela financeira
function atualizarTabelaFinanceiro(alugueis) {
  const tbody = document.getElementById("tabelaFinanceiro");

  if (alugueis.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">
                    <i class="fas fa-chart-line"></i>
                    <p>Nenhum dado financeiro no período</p>
                </td>
            </tr>
        `;
    return;
  }

  // Calcular métricas
  const totalAlugueis = alugueis.length;
  const faturamentoTotal = alugueis.reduce(
    (total, a) => total + (a.valorTotal || 0),
    0,
  );
  const mediaPorAluguel =
    totalAlugueis > 0 ? faturamentoTotal / totalAlugueis : 0;

  const periodo =
    document.getElementById("periodo").options[
      document.getElementById("periodo").selectedIndex
    ].text;

  html = `
        <tr>
            <td>${periodo}</td>
            <td>${totalAlugueis}</td>
            <td>${formatarMoeda(faturamentoTotal)}</td>
            <td>${formatarMoeda(mediaPorAluguel)}</td>
        </tr>
    `;

  tbody.innerHTML = html;
}

// Função para exportar para Excel (simulada)
function exportarExcel() {
  alert("Funcionalidade de exportação para Excel será implementada em breve!");
  // Implementação real usaria uma biblioteca como SheetJS
}

// Função para gerar relatório completo
function gerarRelatorioCompleto() {
  const periodo =
    document.getElementById("periodo").options[
      document.getElementById("periodo").selectedIndex
    ].text;
  const dataAtual = new Date().toLocaleDateString("pt-BR");

  let relatorio = `
        RELATÓRIO COMPLETO - SISTEMA OUROGUEL
        Período: ${periodo}
        Data de geração: ${dataAtual}
        ============================================
        
        RESUMO DO PERÍODO:
        - Total de Aluguéis: ${document.getElementById("totalAlugueis").textContent}
        - Faturamento Total: ${document.getElementById("faturamentoTotal").textContent}
        - Novos Clientes: ${document.getElementById("novosClientes").textContent}
        - Equipamentos Ativos: ${document.getElementById("equipamentosAtivos").textContent}
        
        ============================================
        
        Este relatório foi gerado automaticamente pelo Sistema Ouroguel.
        Sistema desenvolvido como TCC em IHC com foco em usabilidade para pessoas idosas.
    `;

  // Criar blob e baixar
  const blob = new Blob([relatorio], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_ouroguel_${dataAtual.replace(/\//g, "-")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Função para gerar relatório PDF (simulada)
function gerarRelatorioPDF() {
  alert(
    'Funcionalidade de PDF será implementada em breve!\nPor enquanto, use a opção "Relatório Completo" para exportar em TXT.',
  );
  // Implementação real usaria uma biblioteca como jsPDF
}

// Função para imprimir relatório
function imprimirRelatorio() {
  window.print();
}
