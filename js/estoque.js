let estoque = [];
let ajustesHistorico = [];
let paginaAtualEstoque = 1;
const ESTOQUE_POR_PAGINA = 8;
let paginaAtualHistorico = 1;
const HISTORICO_POR_PAGINA = 8;

// ============================================
// FUNÇÕES AUXILIARES DE INTERFACE
// ============================================

function garantirContainerPaginacao(idTabela, idPaginacao, ariaLabel) {
    let paginacao = document.getElementById(idPaginacao);

    if (paginacao) {
        paginacao.style.display = "flex";
        paginacao.style.visibility = "visible";
        paginacao.style.opacity = "1";
        return paginacao;
    }

    const tabela = document.getElementById(idTabela);

    if (!tabela) {
        return null;
    }

    const tableContainer = tabela.closest(".table-container");

    if (!tableContainer) {
        return null;
    }

    paginacao = document.createElement("div");
    paginacao.id = idPaginacao;
    paginacao.className = "pagination-container";
    paginacao.setAttribute("aria-label", ariaLabel);

    paginacao.style.display = "flex";
    paginacao.style.visibility = "visible";
    paginacao.style.opacity = "1";

    tableContainer.insertAdjacentElement("afterend", paginacao);

    return paginacao;
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

function aguardarDependenciasEstoque() {
    if (!window.EstoqueService) {
        throw new Error("EstoqueService não foi carregado.");
    }
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
        aguardarDependenciasEstoque();

        configurarEventosEstoque();

        await carregarEstoque();
        await carregarHistoricoAjustes();
        await carregarEquipamentosParaAjuste();
    } catch (error) {
        console.error("Erro ao inicializar estoque:", error);

        mostrarMensagem(
            "Erro",
            "Não foi possível inicializar a tela de estoque: " + error.message,
            "error"
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
        estoqueList.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando estoque...</p>
        </td>
      </tr>
    `;

        estoque = await EstoqueService.listarEstoque();
        paginaAtualEstoque = 1;

        renderizarTabelaEstoque();
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

function obterEstoqueFiltrado() {
    const categoria = valorCampoEstoque("filtroCategoria").toLowerCase();
    const statusFiltro = valorCampoEstoque("filtroStatus");
    const busca = valorCampoEstoque("filtroBusca").toLowerCase();

    return estoque.filter((item) => {
        const status = obterStatusEstoque(item);

        const textoItem = [
            item.nomeEquipamento,
            item.categoria,
            item.quantidadeTotal,
            item.quantidadeDisponivel,
            item.quantidadeAlugada,
            item.status,
            status.texto,
            item.valorDia,
        ]
            .join(" ")
            .toLowerCase();

        const categoriaItem = String(item.categoria || "").toLowerCase();
        const statusTexto = status.texto.toLowerCase();

        if (categoria && !categoriaItem.includes(categoria)) {
            return false;
        }

        if (statusFiltro) {
            if (statusFiltro === "disponivel" && !statusTexto.includes("disponível")) {
                return false;
            }

            if (statusFiltro === "alugado" && !statusTexto.includes("parcial")) {
                return false;
            }

            if (
                statusFiltro === "indisponivel" &&
                !statusTexto.includes("indisponível") &&
                !statusTexto.includes("esgotado")
            ) {
                return false;
            }

            if (statusFiltro === "manutencao" && !statusTexto.includes("manutenção")) {
                return false;
            }
        }

        if (busca && !textoItem.includes(busca)) {
            return false;
        }

        return true;
    });
}

function renderizarTabelaEstoque() {
    const estoqueList = document.getElementById("estoqueList");

    if (!estoqueList) {
        return;
    }

    const estoqueFiltrado = obterEstoqueFiltrado();

    if (!estoqueFiltrado.length) {
        estoqueList.innerHTML = `
      <tr>
        <td colspan="8" class="empty-message">
          <i class="fas fa-search"></i>
          <p>Nenhum equipamento encontrado com os filtros selecionados</p>
        </td>
      </tr>
    `;

        renderizarPaginacaoEstoque(0);
        return;
    }

    const totalPaginas = Math.ceil(estoqueFiltrado.length / ESTOQUE_POR_PAGINA);

    if (paginaAtualEstoque > totalPaginas) {
        paginaAtualEstoque = totalPaginas;
    }

    const inicio = (paginaAtualEstoque - 1) * ESTOQUE_POR_PAGINA;
    const fim = inicio + ESTOQUE_POR_PAGINA;
    const estoqueDaPagina = estoqueFiltrado.slice(inicio, fim);

    estoqueList.innerHTML = estoqueDaPagina
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

    renderizarPaginacaoEstoque(estoqueFiltrado.length);
}

function renderizarPaginacaoEstoque(totalItens) {
    const paginacao = garantirContainerPaginacao(
        "estoqueTable",
        "estoquePaginacao",
        "Paginação da tabela de estoque"
    );

    if (!paginacao) {
        console.warn("Container estoquePaginacao não encontrado/criado.");
        return;
    }

    if (totalItens <= 0) {
        paginacao.innerHTML = `
            <div class="pagination-info">
                Nenhum item para paginar
            </div>
        `;
        return;
    }

    const totalPaginas = Math.ceil(totalItens / ESTOQUE_POR_PAGINA);
    const inicio = (paginaAtualEstoque - 1) * ESTOQUE_POR_PAGINA + 1;
    const fim = Math.min(paginaAtualEstoque * ESTOQUE_POR_PAGINA, totalItens);

    paginacao.innerHTML = `
        <div class="pagination-info">
            Mostrando ${inicio} a ${fim} de ${totalItens} itens
        </div>
        <div class="pagination-actions">
            <button
                type="button"
                class="btn btn-secondary pagination-btn"
                onclick="mudarPaginaEstoque(${paginaAtualEstoque - 1})"
                ${paginaAtualEstoque === 1 ? "disabled" : ""}
            >
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span class="pagination-current">
                Página ${paginaAtualEstoque} de ${totalPaginas}
            </span>

            <button
                type="button"
                class="btn btn-secondary pagination-btn"
                onclick="mudarPaginaEstoque(${paginaAtualEstoque + 1})"
                ${paginaAtualEstoque === totalPaginas ? "disabled" : ""}
            >
                Próxima <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}

function mudarPaginaEstoque(novaPagina) {
    const totalItens = obterEstoqueFiltrado().length;
    const totalPaginas = Math.ceil(totalItens / ESTOQUE_POR_PAGINA);

    if (novaPagina < 1 || novaPagina > totalPaginas) {
        return;
    }

    paginaAtualEstoque = novaPagina;
    renderizarTabelaEstoque();
}

window.mudarPaginaEstoque = mudarPaginaEstoque;

async function carregarEquipamentosParaAjuste() {
    const select = document.getElementById("ajusteEquipamento");

    if (!select) {
        return;
    }

    try {
        while (select.options.length > 1) {
            select.remove(1);
        }

        const equipamentos = await EstoqueService.listarEstoque();

        equipamentos.forEach((equipamento) => {
            const option = document.createElement("option");
            option.value = equipamento.id;
            option.textContent = `${equipamento.nomeEquipamento || "Equipamento sem nome"} (${equipamento.quantidadeDisponivel || 0} disp.)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar equipamentos para ajuste:", error);
        mostrarMensagem("Erro", "Não foi possível carregar os equipamentos para ajuste.", "error");
    }
}

// ============================================
// FILTROS
// ============================================

function filtrarEstoque() {
    paginaAtualEstoque = 1;
    renderizarTabelaEstoque();
}

function limparFiltros() {
    preencherCampoEstoque("filtroCategoria", "");
    preencherCampoEstoque("filtroStatus", "");
    preencherCampoEstoque("filtroBusca", "");

    paginaAtualEstoque = 1;
    renderizarTabelaEstoque();
}

// ============================================
// ESTATÍSTICAS
// ============================================

function atualizarEstatisticasEstoque() {
    const estatisticas = EstoqueService.calcularEstatisticas(estoque);

    const totalItensEl = document.getElementById("totalItens");
    const disponiveisEl = document.getElementById("disponiveis");
    const alugadosEl = document.getElementById("alugados");
    const indisponiveisEl = document.getElementById("indisponiveis");

    if (totalItensEl) totalItensEl.textContent = estatisticas.totalItens;
    if (disponiveisEl) disponiveisEl.textContent = estatisticas.disponiveis;
    if (alugadosEl) alugadosEl.textContent = estatisticas.alugados;
    if (indisponiveisEl) indisponiveisEl.textContent = estatisticas.indisponiveis;
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
        "info"
    );
}

async function realizarAjuste() {
    const dadosAjuste = {
        equipamentoId: valorCampoEstoque("ajusteEquipamento"),
        tipo: valorCampoEstoque("ajusteTipo"),
        quantidade: parseInt(valorCampoEstoque("ajusteQuantidade"), 10) || 0,
        motivo: valorCampoEstoque("ajusteMotivo"),
    };

    try {
        await EstoqueService.realizarAjuste(dadosAjuste);

        mostrarMensagem("Sucesso", "Ajuste realizado com sucesso!");

        limparAjuste();

        await carregarEstoque();
        await carregarHistoricoAjustes();
        await carregarEquipamentosParaAjuste();
    } catch (error) {
        console.error("Erro ao realizar ajuste:", error);

        mostrarMensagem("Erro", "Erro ao realizar ajuste: " + error.message, "error");
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
        historicoList.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando histórico...</p>
        </td>
      </tr>
    `;

        ajustesHistorico = await EstoqueService.listarHistorico(50);
        paginaAtualHistorico = 1;

        renderizarTabelaHistorico();
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

function montarLinhaHistorico(ajuste) {
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

    const sinal = ajuste.tipo === "entrada" || ajuste.tipo === "retorno" ? "+" : "-";

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
            ajuste.tipo === "entrada" || ajuste.tipo === "retorno" ? "text-success" : "text-danger"
        }">
          ${sinal}${ajuste.quantidade}
        </strong>
      </td>

      <td>${escaparHTMLEstoque(ajuste.motivo)}</td>

      <td>${escaparHTMLEstoque(ajuste.usuario || "Sistema")}</td>
    </tr>
  `;
}

function renderizarTabelaHistorico() {
    const historicoList = document.getElementById("historicoList");

    if (!historicoList) {
        return;
    }

    if (!ajustesHistorico.length) {
        historicoList.innerHTML = `
      <tr>
        <td colspan="6" class="empty-message">
          <i class="fas fa-history"></i>
          <p>Nenhum ajuste registrado</p>
        </td>
      </tr>
    `;

        renderizarPaginacaoHistorico(0);
        return;
    }

    const totalPaginas = Math.ceil(ajustesHistorico.length / HISTORICO_POR_PAGINA);

    if (paginaAtualHistorico > totalPaginas) {
        paginaAtualHistorico = totalPaginas;
    }

    const inicio = (paginaAtualHistorico - 1) * HISTORICO_POR_PAGINA;
    const fim = inicio + HISTORICO_POR_PAGINA;
    const historicoDaPagina = ajustesHistorico.slice(inicio, fim);

    historicoList.innerHTML = historicoDaPagina
        .map((ajuste) => montarLinhaHistorico(ajuste))
        .join("");

    renderizarPaginacaoHistorico(ajustesHistorico.length);
}

function renderizarPaginacaoHistorico(totalItens) {
    const paginacao = garantirContainerPaginacao(
        "historicoTable",
        "historicoPaginacao",
        "Paginação da tabela de histórico de ajustes"
    );

    if (!paginacao) {
        console.warn("Container historicoPaginacao não encontrado/criado.");
        return;
    }

    if (totalItens <= 0) {
        paginacao.innerHTML = `
            <div class="pagination-info">
                Nenhum ajuste para paginar
            </div>
        `;
        return;
    }

    const totalPaginas = Math.ceil(totalItens / HISTORICO_POR_PAGINA);
    const inicio = (paginaAtualHistorico - 1) * HISTORICO_POR_PAGINA + 1;
    const fim = Math.min(paginaAtualHistorico * HISTORICO_POR_PAGINA, totalItens);

    paginacao.innerHTML = `
        <div class="pagination-info">
            Mostrando ${inicio} a ${fim} de ${totalItens} ajustes
        </div>
        <div class="pagination-actions">
            <button
                type="button"
                class="btn btn-secondary pagination-btn"
                onclick="mudarPaginaHistorico(${paginaAtualHistorico - 1})"
                ${paginaAtualHistorico === 1 ? "disabled" : ""}
            >
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span class="pagination-current">
                Página ${paginaAtualHistorico} de ${totalPaginas}
            </span>

            <button
                type="button"
                class="btn btn-secondary pagination-btn"
                onclick="mudarPaginaHistorico(${paginaAtualHistorico + 1})"
                ${paginaAtualHistorico === totalPaginas ? "disabled" : ""}
            >
                Próxima <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}

function mudarPaginaHistorico(novaPagina) {
    const totalItens = ajustesHistorico.length;
    const totalPaginas = Math.ceil(totalItens / HISTORICO_POR_PAGINA);

    if (novaPagina < 1 || novaPagina > totalPaginas) {
        return;
    }

    paginaAtualHistorico = novaPagina;
    renderizarTabelaHistorico();
}

window.mudarPaginaHistorico = mudarPaginaHistorico;

// ============================================
// DETALHES E LIMPEZA
// ============================================

async function visualizarDetalhes(equipamentoId) {
    try {
        const equipamento = await EstoqueService.obterEquipamentoPorId(equipamentoId);

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
