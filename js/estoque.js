(function () {
    const estado = (globalThis.__estoquePageState = globalThis.__estoquePageState || {
        estoque: [],
        estoqueFiltrado: [],
        ajustesHistorico: [],
        paginaAtualEstoque: 1,
    });

    const ITENS_POR_PAGINA_ESTOQUE = 8;

    // =====================================================
    // FALLBACK DO ESTOQUESERVICE
    // Garante que EstoqueService exista mesmo se o service externo falhar
    // =====================================================

    if (!globalThis.EstoqueService) {
        globalThis.EstoqueService = {
            async listarEstoque() {
                const db = await aguardarFirebaseTelaEstoque();
                const snapshot = await db.collection("equipamentos").get();
                const equipamentos = [];

                snapshot.forEach((doc) => {
                    const dados = doc.data();

                    if (dados.ativo === false) {
                        return;
                    }

                    equipamentos.push({
                        id: doc.id,
                        ...dados,
                        quantidadeTotal: Number(dados.quantidadeTotal || 0),
                        quantidadeDisponivel: Number(dados.quantidadeDisponivel || 0),
                        quantidadeAlugada: Number(dados.quantidadeAlugada || 0),
                        quantidadeManutencao: Number(dados.quantidadeManutencao || 0),
                        valorHora: Number(dados.valorHora || 0),
                        valorDia: Number(dados.valorDia || 0),
                        valorMes: Number(dados.valorMes || 0),
                    });
                });

                equipamentos.sort((a, b) =>
                    String(a.nomeEquipamento || "").localeCompare(
                        String(b.nomeEquipamento || ""),
                        "pt-BR"
                    )
                );

                return equipamentos;
            },
            async obterEquipamentoPorId(equipamentoId) {
                const db = await aguardarFirebaseTelaEstoque();
                const doc = await db.collection("equipamentos").doc(equipamentoId).get();

                if (!doc.exists) {
                    return null;
                }

                return {
                    id: doc.id,
                    ...doc.data(),
                };
            },
            calcularEstatisticas(listaEstoque) {
                const estatisticas = {
                    totalItens: 0,
                    disponiveis: 0,
                    alugados: 0,
                    indisponiveis: 0,
                };

                listaEstoque.forEach((item) => {
                    const quantidadeTotal = Number(item.quantidadeTotal || 0);
                    const quantidadeDisponivel = Number(item.quantidadeDisponivel || 0);
                    const quantidadeAlugada = Number(item.quantidadeAlugada || 0);

                    estatisticas.totalItens += quantidadeTotal;
                    estatisticas.disponiveis += quantidadeDisponivel;
                    estatisticas.alugados += quantidadeAlugada;

                    if (quantidadeDisponivel <= 0 || item.status === "indisponivel") {
                        estatisticas.indisponiveis += 1;
                    }
                });

                return estatisticas;
            },
            async listarHistorico(limite = 50) {
                const db = await aguardarFirebaseTelaEstoque();

                try {
                    const snapshot = await db
                        .collection("historicoEstoque")
                        .orderBy("data", "desc")
                        .limit(limite)
                        .get();

                    const historico = [];

                    snapshot.forEach((doc) => {
                        historico.push({
                            id: doc.id,
                            ...doc.data(),
                        });
                    });

                    return historico;
                } catch (error) {
                    console.warn("Histórico de estoque não encontrado ou sem índice:", error);
                    return [];
                }
            },
            async realizarAjuste(dadosAjuste) {
                const db = await aguardarFirebaseTelaEstoque();

                if (!dadosAjuste.equipamentoId) {
                    throw new Error("Selecione um equipamento.");
                }

                if (!dadosAjuste.quantidade || dadosAjuste.quantidade <= 0) {
                    throw new Error("Informe uma quantidade válida.");
                }

                const equipamentoRef = db.collection("equipamentos").doc(dadosAjuste.equipamentoId);
                const equipamentoDoc = await equipamentoRef.get();

                if (!equipamentoDoc.exists) {
                    throw new Error("Equipamento não encontrado.");
                }

                const equipamento = equipamentoDoc.data();

                let quantidadeTotal = Number(equipamento.quantidadeTotal || 0);
                let quantidadeDisponivel = Number(equipamento.quantidadeDisponivel || 0);
                let quantidadeAlugada = Number(equipamento.quantidadeAlugada || 0);
                let quantidadeManutencao = Number(equipamento.quantidadeManutencao || 0);

                const quantidade = Number(dadosAjuste.quantidade);

                switch (dadosAjuste.tipo) {
                    case "entrada":
                        quantidadeTotal += quantidade;
                        quantidadeDisponivel += quantidade;
                        break;

                    case "saida":
                        if (quantidadeDisponivel < quantidade) {
                            throw new Error("Quantidade disponível insuficiente para saída.");
                        }

                        quantidadeTotal -= quantidade;
                        quantidadeDisponivel -= quantidade;
                        break;

                    case "manutencao":
                        if (quantidadeDisponivel < quantidade) {
                            throw new Error("Quantidade disponível insuficiente para manutenção.");
                        }

                        quantidadeDisponivel -= quantidade;
                        quantidadeManutencao += quantidade;
                        break;

                    case "retorno":
                        if (quantidadeManutencao < quantidade) {
                            throw new Error("Quantidade em manutenção insuficiente para retorno.");
                        }

                        quantidadeManutencao -= quantidade;
                        quantidadeDisponivel += quantidade;
                        break;

                    default:
                        throw new Error("Tipo de ajuste inválido.");
                }

                await equipamentoRef.update({
                    quantidadeTotal,
                    quantidadeDisponivel,
                    quantidadeAlugada,
                    quantidadeManutencao,
                    dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp(),
                });

                await db.collection("historicoEstoque").add({
                    equipamentoId: dadosAjuste.equipamentoId,
                    equipamentoNome: equipamento.nomeEquipamento || "Equipamento sem nome",
                    tipo: dadosAjuste.tipo,
                    quantidade,
                    motivo: dadosAjuste.motivo || "Ajuste manual",
                    usuario: localStorage.getItem("userEmail") || "Sistema",
                    data: firebase.firestore.FieldValue.serverTimestamp(),
                });

                return true;
            },
        };
    }

    // ============================================
    // FUNÇÕES AUXILIARES DE INTERFACE
    // ============================================

    async function aguardarFirebaseTelaEstoque() {
        if (globalThis.firebaseReady) {
            await globalThis.firebaseReady;
        }

        if (globalThis.db) {
            return globalThis.db;
        }

        if (globalThis.firebase && firebase.firestore) {
            return firebase.firestore();
        }

        throw new Error("Firebase Firestore não foi carregado.");
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

    function normalizarTextoEstoque(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replaceAll("_", " ")
            .toLowerCase()
            .trim();
    }

    function formatarMoedaEstoque(valor) {
        if (typeof globalThis.formatarMoeda === "function") {
            return globalThis.formatarMoeda(valor);
        }

        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(Number(valor || 0));
    }

    function formatarDataEstoque(data) {
        if (typeof globalThis.formatarData === "function") {
            return globalThis.formatarData(data);
        }

        if (!data) {
            return "";
        }

        const dataObj = data.toDate ? data.toDate() : new Date(data);
        return dataObj.toLocaleDateString("pt-BR");
    }

    function mostrarMensagemEstoque(titulo, mensagem, tipo = "info") {
        if (typeof globalThis.mostrarMensagem === "function") {
            globalThis.mostrarMensagem(titulo, mensagem, tipo);
            return;
        }

        alert(`${titulo}: ${mensagem}`);
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

    async function aguardarDependenciasEstoque() {
        await aguardarFirebaseTelaEstoque();

        if (!globalThis.EstoqueService) {
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

    function garantirContainerPaginacaoEstoque() {
        let paginacao = document.getElementById("paginacaoEstoque");

        if (paginacao) {
            return paginacao;
        }

        const tabela = document.getElementById("estoqueTable");

        if (!tabela?.parentElement) {
            return null;
        }

        paginacao = document.createElement("div");
        paginacao.id = "paginacaoEstoque";
        paginacao.className = "pagination-container";
        paginacao.setAttribute("aria-label", "Paginação da tabela de estoque");

        tabela.parentElement.insertAdjacentElement("afterend", paginacao);

        return paginacao;
    }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================

    document.addEventListener("DOMContentLoaded", async function () {
        try {
            await aguardarDependenciasEstoque();

            configurarEventosEstoque();
            garantirContainerPaginacaoEstoque();

            await carregarEstoque();
            await carregarHistoricoAjustes();
            await carregarEquipamentosParaAjuste();
        } catch (error) {
            console.error("Erro ao inicializar estoque:", error);

            mostrarMensagemEstoque(
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

            estado.estoque = await EstoqueService.listarEstoque();
            estado.estoqueFiltrado = [...estado.estoque];
            estado.paginaAtualEstoque = 1;

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

            renderizarPaginacaoEstoque(0);
        }
    }

    function renderizarLinhaEstoque(item) {
        const status = obterStatusEstoque(item);

        const quantidadeTotal = Number(item.quantidadeTotal || 0);
        const quantidadeDisponivel = Number(item.quantidadeDisponivel || 0);
        const quantidadeAlugada = Number(item.quantidadeAlugada || 0);

        const porcentagemDisponivel =
            quantidadeTotal > 0 ? Math.round((quantidadeDisponivel / quantidadeTotal) * 100) : 0;

        let corBarra = "#e74c3c";
        if (porcentagemDisponivel >= 50) {
            corBarra = "#27ae60";
        } else if (porcentagemDisponivel >= 25) {
            corBarra = "#f39c12";
        }

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
    }

    function renderizarTabelaEstoque() {
        const estoqueList = document.getElementById("estoqueList");

        if (!estoqueList) {
            return;
        }

        if (!estado.estoque.length) {
            estoqueList.innerHTML = `
        <tr>
          <td colspan="8" class="empty-message">
            <i class="fas fa-clipboard-list"></i>
            <p>Nenhum equipamento cadastrado no estoque</p>
          </td>
        </tr>
      `;

            renderizarPaginacaoEstoque(0);
            return;
        }

        if (!estado.estoqueFiltrado.length) {
            estoqueList.innerHTML = `
        <tr>
          <td colspan="8" class="empty-message">
            <i class="fas fa-search"></i>
            <p>Nenhum equipamento encontrado</p>
          </td>
        </tr>
      `;

            renderizarPaginacaoEstoque(0);
            return;
        }

        const totalPaginas = Math.ceil(estado.estoqueFiltrado.length / ITENS_POR_PAGINA_ESTOQUE);

        if (estado.paginaAtualEstoque > totalPaginas) {
            estado.paginaAtualEstoque = totalPaginas;
        }

        if (estado.paginaAtualEstoque < 1) {
            estado.paginaAtualEstoque = 1;
        }

        const inicio = (estado.paginaAtualEstoque - 1) * ITENS_POR_PAGINA_ESTOQUE;
        const fim = inicio + ITENS_POR_PAGINA_ESTOQUE;
        const itensDaPagina = estado.estoqueFiltrado.slice(inicio, fim);

        estoqueList.innerHTML = itensDaPagina.map(renderizarLinhaEstoque).join("");

        renderizarPaginacaoEstoque(estado.estoqueFiltrado.length);
    }

    function renderizarPaginacaoEstoque(totalEstoque = estado.estoqueFiltrado.length) {
        const paginacao = garantirContainerPaginacaoEstoque();

        if (!paginacao) {
            return;
        }

        const totalPaginas = Math.ceil(totalEstoque / ITENS_POR_PAGINA_ESTOQUE);

        if (totalPaginas <= 1) {
            paginacao.innerHTML = "";
            return;
        }

        const inicio = (estado.paginaAtualEstoque - 1) * ITENS_POR_PAGINA_ESTOQUE + 1;
        const fim = Math.min(estado.paginaAtualEstoque * ITENS_POR_PAGINA_ESTOQUE, totalEstoque);

        paginacao.innerHTML = `
        <div class="pagination-info">
          Mostrando ${inicio} a ${fim} de ${totalEstoque} equipamentos
        </div>
        <div class="pagination-actions">
          <button
            type="button"
            class="btn btn-secondary pagination-btn"
            onclick="mudarPaginaEstoque(${estado.paginaAtualEstoque - 1})"
            ${estado.paginaAtualEstoque === 1 ? "disabled" : ""}
          >
            <i class="fas fa-chevron-left"></i> Anterior
          </button>
          <span class="pagination-current">
            Página ${estado.paginaAtualEstoque} de ${totalPaginas}
          </span>

          <button
            type="button"
            class="btn btn-secondary pagination-btn"
            onclick="mudarPaginaEstoque(${estado.paginaAtualEstoque + 1})"
            ${estado.paginaAtualEstoque === totalPaginas ? "disabled" : ""}
          >
            Próxima <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      `;
    }

    function mudarPaginaEstoque(novaPagina) {
        const totalEstoque = estado.estoqueFiltrado.length;
        const totalPaginas = Math.ceil(totalEstoque / ITENS_POR_PAGINA_ESTOQUE);

        if (novaPagina < 1 || novaPagina > totalPaginas) {
            return;
        }

        estado.paginaAtualEstoque = novaPagina;
        renderizarTabelaEstoque();
    }

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
            mostrarMensagemEstoque(
                "Erro",
                "Não foi possível carregar os equipamentos para ajuste.",
                "error"
            );
        }
    }

    // ============================================
    // FILTROS
    // ============================================

    function itemPassaStatusSelecionadoEstoque(statusSelecionado, statusTexto, quantidadeAlugada) {
        if (statusSelecionado === "disponivel") {
            return statusTexto.includes("disponivel");
        }

        if (statusSelecionado === "alugado") {
            return statusTexto.includes("parcial") || quantidadeAlugada > 0;
        }

        if (statusSelecionado === "indisponivel") {
            return statusTexto.includes("indisponivel") || statusTexto.includes("esgotado");
        }

        if (statusSelecionado === "manutencao") {
            return statusTexto.includes("manutencao");
        }

        return true;
    }

    function itemPassaNosFiltrosEstoque(item) {
        const categoriaSelecionada = normalizarTextoEstoque(valorCampoEstoque("filtroCategoria"));
        const statusSelecionado = valorCampoEstoque("filtroStatus");
        const busca = normalizarTextoEstoque(valorCampoEstoque("filtroBusca"));
        const status = obterStatusEstoque(item);

        const categoriaItem = normalizarTextoEstoque(item.categoria);
        const textoBuscaItem = normalizarTextoEstoque(
            [
                item.nomeEquipamento,
                item.categoria,
                item.quantidadeTotal,
                item.quantidadeDisponivel,
                item.quantidadeAlugada,
                item.valorDia,
                status.texto,
            ].join(" ")
        );

        if (categoriaSelecionada && !categoriaItem.includes(categoriaSelecionada)) {
            return false;
        }

        if (statusSelecionado) {
            const statusTexto = normalizarTextoEstoque(status.texto);
            const quantidadeAlugada = Number(item.quantidadeAlugada || 0);
            if (
                !itemPassaStatusSelecionadoEstoque(
                    statusSelecionado,
                    statusTexto,
                    quantidadeAlugada
                )
            ) {
                return false;
            }
        }

        if (busca && !textoBuscaItem.includes(busca)) {
            return false;
        }

        return true;
    }

    function filtrarEstoque() {
        estado.estoqueFiltrado = estado.estoque.filter(itemPassaNosFiltrosEstoque);
        estado.paginaAtualEstoque = 1;
        renderizarTabelaEstoque();
    }

    function limparFiltros() {
        preencherCampoEstoque("filtroCategoria", "");
        preencherCampoEstoque("filtroStatus", "");
        preencherCampoEstoque("filtroBusca", "");

        estado.estoqueFiltrado = [...estado.estoque];
        estado.paginaAtualEstoque = 1;
        renderizarTabelaEstoque();
    }

    // ============================================
    // ESTATÍSTICAS
    // ============================================

    function atualizarEstatisticasEstoque() {
        const estatisticas = EstoqueService.calcularEstatisticas(estado.estoque);

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
        const equipamento = estado.estoque.find((item) => item.id === equipamentoId);

        if (!equipamento) {
            mostrarMensagemEstoque("Erro", "Equipamento não encontrado na lista.", "error");
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

        mostrarMensagemEstoque(
            "Informação",
            `Pronto para ajustar o estoque de: ${equipamento.nomeEquipamento}`,
            "info"
        );
    }

    async function realizarAjuste() {
        const dadosAjuste = {
            equipamentoId: valorCampoEstoque("ajusteEquipamento"),
            tipo: valorCampoEstoque("ajusteTipo"),
            quantidade: Number.parseInt(valorCampoEstoque("ajusteQuantidade"), 10) || 0,
            motivo: valorCampoEstoque("ajusteMotivo"),
        };

        try {
            await EstoqueService.realizarAjuste(dadosAjuste);

            mostrarMensagemEstoque("Sucesso", "Ajuste realizado com sucesso!", "success");

            limparAjuste();

            await carregarEstoque();
            await carregarHistoricoAjustes();
            await carregarEquipamentosParaAjuste();
        } catch (error) {
            console.error("Erro ao realizar ajuste:", error);

            mostrarMensagemEstoque("Erro", "Erro ao realizar ajuste: " + error.message, "error");
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

            estado.ajustesHistorico = await EstoqueService.listarHistorico(50);

            if (!estado.ajustesHistorico.length) {
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

            historicoList.innerHTML = estado.ajustesHistorico
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
            const equipamento = await EstoqueService.obterEquipamentoPorId(equipamentoId);

            if (!equipamento) {
                mostrarMensagemEstoque("Erro", "Equipamento não encontrado.", "error");
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

            mostrarMensagemEstoque("Erro", "Não foi possível carregar os detalhes.", "error");
        }
    }

    function limparAjuste() {
        preencherCampoEstoque("ajusteEquipamento", "");
        preencherCampoEstoque("ajusteTipo", "entrada");
        preencherCampoEstoque("ajusteQuantidade", 1);
        preencherCampoEstoque("ajusteMotivo", "");
    }

    // ============================================
    // EXPORTAÇÃO PARA ONCLICK DO HTML
    // ============================================

    globalThis.carregarEstoque = carregarEstoque;
    globalThis.renderizarTabelaEstoque = renderizarTabelaEstoque;
    globalThis.renderizarPaginacaoEstoque = renderizarPaginacaoEstoque;
    globalThis.mudarPaginaEstoque = mudarPaginaEstoque;
    globalThis.filtrarEstoque = filtrarEstoque;
    globalThis.limparFiltros = limparFiltros;
    globalThis.ajustarEstoqueRapido = ajustarEstoqueRapido;
    globalThis.realizarAjuste = realizarAjuste;
    globalThis.carregarHistoricoAjustes = carregarHistoricoAjustes;
    globalThis.carregarEquipamentosParaAjuste = carregarEquipamentosParaAjuste;
    globalThis.visualizarDetalhes = visualizarDetalhes;
    globalThis.limparAjuste = limparAjuste;
})();
