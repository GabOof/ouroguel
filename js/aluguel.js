let alugueis = [];
let equipamentosDisponiveis = [];
let equipamentosSelecionados = [];
let clienteSelecionado = null;
let aluguelFechando = null;
let paginaAtualAlugueis = 1;
const ALUGUEIS_POR_PAGINA = 8;

// ============================================
// FUNÇÕES AUXILIARES DE INTERFACE
// ============================================
function abrirModalAluguel() {
    const modal = document.getElementById("aluguelModal");

    if (!modal) {
        return;
    }

    modal.style.display = "flex";
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function fecharModalAluguel() {
    const modal = document.getElementById("aluguelModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
}

function abrirModalNovoAluguel() {
    limparFormularioAluguel();
    abrirModalAluguel();

    setTimeout(() => {
        document.getElementById("clienteSelect")?.focus();
    }, 100);
}

window.abrirModalAluguel = abrirModalAluguel;
window.fecharModalAluguel = fecharModalAluguel;
window.abrirModalNovoAluguel = abrirModalNovoAluguel;

function valorCampo(id) {
    const campo = document.getElementById(id);
    return campo ? campo.value.trim() : "";
}

function preencherCampo(id, valor) {
    const campo = document.getElementById(id);

    if (!campo) {
        return;
    }

    if ("value" in campo) {
        campo.value = valor ?? "";
    } else {
        campo.textContent = valor ?? "";
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
    }).format(Number(valor || 0));
}

function formatarDataAluguel(dataISO) {
    if (!dataISO) return "-";

    if (typeof formatarData === "function") {
        return formatarData(dataISO);
    }

    const [ano, mes, dia] = String(dataISO).split("-");

    if (!ano || !mes || !dia) {
        return dataISO;
    }

    return `${dia}/${mes}/${ano}`;
}

function dataHojeISO() {
    const hoje = new Date();
    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
    return hoje.toISOString().split("T")[0];
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

function normalizarTextoBusca(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function temAlgumPreco(equipamento) {
    return (
        Number(equipamento.valorHora || 0) > 0 ||
        Number(equipamento.valorDia || 0) > 0 ||
        Number(equipamento.valorMes || 0) > 0
    );
}

function obterTextoPeriodo(periodo) {
    if (periodo === "hora") return "Por Hora";
    if (periodo === "dia") return "Por Dia";
    if (periodo === "mes") return "Por Mês";
    return "Não definido";
}

function obterValorPorPeriodo(equipamento, periodo) {
    if (periodo === "hora") return Number(equipamento.valorHora || 0);
    if (periodo === "dia") return Number(equipamento.valorDia || 0);
    if (periodo === "mes") return Number(equipamento.valorMes || 0);

    return 0;
}

function obterRotuloUnidadeCobranca(item) {
    if (item.rotuloUnidadeCobranca) return item.rotuloUnidadeCobranca;

    const unidade = item.unidadeCobranca || "unidade";

    const rotulos = {
        unidade: "unid.",
        metro: "m",
        metro2: "m²",
        m2: "m²",
        duzia: "dúzia",
        conjunto: "conj.",
        jogo: "jogo",
        quilo: "kg",
        kg: "kg",
        dosagem: "200 ml",
    };

    return rotulos[unidade] || "unid.";
}

function calcularDuracaoRealLocal(dataInicio, dataFim, periodo) {
    if (!dataInicio || !dataFim || !periodo) return 1;

    const criarData = (valor) => {
        const [ano, mes, dia] = String(valor || "")
            .split("-")
            .map(Number);
        return new Date(ano, mes - 1, dia);
    };

    const inicio = criarData(dataInicio);
    const fim = criarData(dataFim);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        return 1;
    }

    const diffMs = Math.max(0, fim.getTime() - inicio.getTime());

    if (periodo === "hora") {
        return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    }

    if (periodo === "mes") {
        let meses =
            (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth());

        if (fim.getDate() > inicio.getDate()) meses += 1;

        return Math.max(1, meses);
    }

    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function obterQuantidadeCobradaPadrao(item) {
    const unidade = item.unidadeCobranca || "unidade";

    if (["unidade", "conjunto", "jogo"].includes(unidade)) {
        return Number(item.quantidadeEstoque || item.quantidade || 1);
    }

    return Number(item.quantidadeCobradaFinal || item.quantidadeCobrada || 1);
}

function mostrarErroAluguel(titulo, mensagem) {
    if (typeof mostrarMensagem === "function") {
        mostrarMensagem(titulo, mensagem, "error");
        return;
    }

    alert(`${titulo}: ${mensagem}`);
}

function mostrarAvisoAluguel(titulo, mensagem) {
    if (typeof mostrarMensagem === "function") {
        mostrarMensagem(titulo, mensagem, "warning");
        return;
    }

    alert(`${titulo}: ${mensagem}`);
}

function mostrarSucessoAluguel(titulo, mensagem) {
    if (typeof mostrarMensagem === "function") {
        mostrarMensagem(titulo, mensagem, "success");
        return;
    }

    alert(`${titulo}: ${mensagem}`);
}

async function aguardarFirebaseTelaAluguel() {
    if (window.firebaseReady) {
        await window.firebaseReady;
    }

    if (!window.db || !window.auth) {
        throw new Error("Firebase Auth ou Firestore não inicializado.");
    }

    await new Promise((resolve, reject) => {
        const unsubscribe = window.auth.onAuthStateChanged((usuario) => {
            unsubscribe();

            if (usuario) {
                resolve(usuario);
            } else {
                reject(new Error("Usuário não autenticado no Firebase Auth."));
            }
        });
    });

    return window.db;
}

async function aguardarDependenciasAluguel() {
    await aguardarFirebaseTelaAluguel();

    if (!window.AluguelService) {
        throw new Error("AluguelService não foi carregado.");
    }
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function carregarClientesParaSelect() {
    const select = document.getElementById("clienteSelect");

    if (!select) return;

    const db = await aguardarFirebaseTelaAluguel();

    select.innerHTML = '<option value="">Carregando clientes...</option>';

    const snapshot = await db.collection("clientes").orderBy("nome").get();

    if (snapshot.empty) {
        select.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
        return;
    }

    select.innerHTML =
        '<option value="">Clique para selecionar um cliente</option>' +
        snapshot.docs
            .map((doc) => {
                const cliente = { id: doc.id, ...doc.data() };
                const nome = escaparHTMLAluguel(cliente.nomeBusca || "Cliente sem nome");
                const cpf = escaparHTMLAluguel(cliente.cpf || "");

                return `<option value="${doc.id}">${nome}${cpf ? " - " + cpf : ""}</option>`;
            })
            .join("");
}

async function buscarClientePorId(clienteId) {
    if (!clienteId) return null;

    const db = await aguardarFirebaseTelaAluguel();
    const doc = await db.collection("clientes").doc(clienteId).get();

    if (!doc.exists) return null;

    return {
        id: doc.id,
        ...doc.data(),
    };
}

async function carregarEquipamentosParaSelect() {
    const select = document.getElementById("equipamentoSelect");

    if (!select) return;

    const db = await aguardarFirebaseTelaAluguel();

    select.innerHTML = '<option value="">Carregando equipamentos...</option>';

    const snapshot = await db.collection("equipamentos").orderBy("nomeEquipamento").get();

    equipamentosDisponiveis = snapshot.docs
        .map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }))
        .filter((equipamento) => {
            const quantidadeDisponivel = Number(equipamento.quantidadeDisponivel || 0);
            return (
                equipamento.ativo !== false &&
                equipamento.status === "disponivel" &&
                quantidadeDisponivel > 0 &&
                temAlgumPreco(equipamento)
            );
        });

    if (!equipamentosDisponiveis.length) {
        select.innerHTML = '<option value="">Nenhum equipamento alugável disponível</option>';
        return;
    }

    select.innerHTML =
        '<option value="">Clique para selecionar um equipamento</option>' +
        equipamentosDisponiveis
            .map((equipamento) => {
                const nome = escaparHTMLAluguel(
                    equipamento.nomeEquipamento || "Equipamento sem nome"
                );
                const quantidade = Number(equipamento.quantidadeDisponivel || 0);
                const unidade = escaparHTMLAluguel(obterRotuloUnidadeCobranca(equipamento));

                return `<option value="${equipamento.id}">${nome} - Disp: ${quantidade} - Cobrança: ${unidade}</option>`;
            })
            .join("");
}

async function buscarEquipamentoPorId(equipamentoId) {
    const equipamentoLocal = equipamentosDisponiveis.find((item) => item.id === equipamentoId);

    if (equipamentoLocal) {
        return equipamentoLocal;
    }

    const db = await aguardarFirebaseTelaAluguel();
    const doc = await db.collection("equipamentos").doc(equipamentoId).get();

    if (!doc.exists) return null;

    return {
        id: doc.id,
        ...doc.data(),
    };
}

// ============================================
// CONFIGURAÇÃO DA TELA
// ============================================

function configurarFormularioAluguel() {
    const form = document.getElementById("aluguelForm");
    const dataInicio = document.getElementById("dataInicio");
    const clienteSelect = document.getElementById("clienteSelect");
    const equipamentoSelect = document.getElementById("equipamentoSelect");
    const btnAdicionar = document.getElementById("btnAdicionarEquipamento");
    const btnLimpar = document.getElementById("btnLimparAluguel");
    const btnImprimir = document.getElementById("btnImprimir");
    const buscaAlugueis = document.getElementById("searchAlugueis");

    if (form) {
        form.addEventListener("submit", registrarAluguel);
    }

    if (dataInicio) {
        dataInicio.value = dataHojeISO();
        dataInicio.min = dataHojeISO();
    }

    if (clienteSelect) {
        clienteSelect.addEventListener("change", atualizarInfoCliente);
    }

    if (equipamentoSelect) {
        equipamentoSelect.addEventListener("change", atualizarInfoEquipamento);
    }

    if (btnAdicionar) {
        btnAdicionar.addEventListener("click", adicionarEquipamento);
    }

    if (btnLimpar) {
        btnLimpar.addEventListener("click", limparFormularioAluguel);
    }

    if (btnImprimir) {
        btnImprimir.disabled = true;
        btnImprimir.style.display = "none";
        btnImprimir.addEventListener("click", imprimirContrato);
    }

    if (buscaAlugueis) {
        buscaAlugueis.addEventListener("keyup", buscarAlugueis);
    }

    configurarModalFechamento();
}

function configurarModalFechamento() {
    const idsRecalculo = [
        "dataDevolucaoReal",
        "periodoFechamento",
        "duracaoReal",
        "descontoFechamento",
        "acrescimoFechamento",
        "valorPagoFechamento",
    ];

    idsRecalculo.forEach((id) => {
        const campo = document.getElementById(id);

        if (campo) {
            campo.addEventListener("input", recalcularFechamento);
            campo.addEventListener("change", recalcularFechamento);
        }
    });

    const btnCancelarTopo = document.getElementById("btnCancelarFechamento");
    const btnCancelarRodape = document.getElementById("btnFecharModalRodape");
    const btnConfirmar = document.getElementById("btnConfirmarFechamento");

    if (btnCancelarTopo) {
        btnCancelarTopo.addEventListener("click", fecharModalFechamento);
    }

    if (btnCancelarRodape) {
        btnCancelarRodape.addEventListener("click", fecharModalFechamento);
    }

    if (btnConfirmar) {
        btnConfirmar.addEventListener("click", confirmarFechamentoAluguel);
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    try {
        await aguardarDependenciasAluguel();

        configurarFormularioAluguel();

        await carregarClientesParaSelect();
        await carregarEquipamentosParaSelect();
        await carregarAlugueis();

        const houvePreSelecao = await aplicarPreSelecoes();

        if (houvePreSelecao) {
            abrirModalAluguel();
        } else {
            fecharModalAluguel();
        }
    } catch (error) {
        console.error("Erro ao inicializar tela de aluguel:", error);

        mostrarErroAluguel(
            "Erro",
            "Não foi possível inicializar a tela de aluguéis: " + error.message
        );
    }
});

async function aplicarPreSelecoes() {
    let houvePreSelecao = false;

    const clienteId = localStorage.getItem("clienteSelecionado");

    if (clienteId) {
        preencherCampo("clienteSelect", clienteId);
        await atualizarInfoCliente();
        localStorage.removeItem("clienteSelecionado");
        houvePreSelecao = true;
    }

    const equipamentoId = localStorage.getItem("equipamentoSelecionado");

    if (equipamentoId) {
        preencherCampo("equipamentoSelect", equipamentoId);
        await atualizarInfoEquipamento();
        localStorage.removeItem("equipamentoSelecionado");
        houvePreSelecao = true;
    }

    return houvePreSelecao;
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
            mostrarErroAluguel("Erro", "Cliente não encontrado.");
            clienteSelecionado = null;
            return;
        }

        preencherCampo("clienteTelefone", cliente.telefone || "");
        preencherCampo("clienteCelular", cliente.celular || "");
        preencherCampo("clienteCPF", cliente.cpf || "");
        preencherCampo(
            "clienteCidade",
            `${cliente.cidade || ""}${cliente.estado ? "/" + cliente.estado : ""}`
        );

        if (infoCliente) {
            infoCliente.style.display = "block";
        }

        clienteSelecionado = cliente;
    } catch (error) {
        console.error("Erro ao carregar informações do cliente:", error);
        mostrarErroAluguel("Erro", "Erro ao carregar cliente.");
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
            mostrarErroAluguel("Erro", "Equipamento não encontrado.");
            return;
        }

        const quantidadeDisponivel = Number(equipamento.quantidadeDisponivel || 0);
        const precos = [
            Number(equipamento.valorHora || 0) > 0
                ? `Hora: ${formatarMoedaAluguel(equipamento.valorHora)}`
                : "",
            Number(equipamento.valorDia || 0) > 0
                ? `Dia: ${formatarMoedaAluguel(equipamento.valorDia)}`
                : "",
            Number(equipamento.valorMes || 0) > 0
                ? `Mês: ${formatarMoedaAluguel(equipamento.valorMes)}`
                : "",
        ]
            .filter(Boolean)
            .join(" | ");

        preencherCampo("equipamentoDisponivel", quantidadeDisponivel);
        preencherCampo("equipamentoUnidade", obterRotuloUnidadeCobranca(equipamento));
        preencherCampo("equipamentoPrecos", precos || "Sem preço configurado");

        const quantidadeInput = document.getElementById("quantidadeAlugar");

        if (quantidadeInput) {
            quantidadeInput.max = quantidadeDisponivel;
            quantidadeInput.value = quantidadeDisponivel > 0 ? 1 : 0;
        }

        if (infoEquipamento) {
            infoEquipamento.style.display = "block";
        }

        if (equipamento.status !== "disponivel" || quantidadeDisponivel <= 0) {
            mostrarAvisoAluguel(
                "Atenção",
                "Este equipamento não possui estoque disponível para aluguel."
            );
        }
    } catch (error) {
        console.error("Erro ao carregar informações do equipamento:", error);
        mostrarErroAluguel("Erro", "Erro ao carregar equipamento.");
    }
}

function adicionarEquipamento() {
    const equipamentoId = valorCampo("equipamentoSelect");
    const quantidadeEstoque = parseInt(valorCampo("quantidadeAlugar"), 10) || 0;

    if (!equipamentoId) {
        mostrarAvisoAluguel("Atenção", "Selecione um equipamento primeiro.");
        return;
    }

    if (quantidadeEstoque <= 0) {
        mostrarErroAluguel("Erro", "A quantidade retirada deve ser maior que zero.");
        return;
    }

    const equipamentoData = equipamentosDisponiveis.find((item) => item.id === equipamentoId);

    if (!equipamentoData) {
        mostrarErroAluguel("Erro", "Não foi possível ler os dados do equipamento selecionado.");
        return;
    }

    const quantidadeDisponivel = Number(equipamentoData.quantidadeDisponivel || 0);

    const existente = equipamentosSelecionados.find((item) => item.id === equipamentoId);

    const quantidadeJaSelecionada = existente
        ? Number(existente.quantidadeEstoque || existente.quantidade || 0)
        : 0;

    if (quantidadeEstoque + quantidadeJaSelecionada > quantidadeDisponivel) {
        mostrarErroAluguel(
            "Erro",
            `Quantidade indisponível. Estoque disponível: ${quantidadeDisponivel}.`
        );
        return;
    }

    if (existente) {
        existente.quantidadeEstoque += quantidadeEstoque;
        existente.quantidade = existente.quantidadeEstoque;
    } else {
        const nomeEquipamento =
            equipamentoData.nomeEquipamento || equipamentoData.nome || "Equipamento";

        equipamentosSelecionados.push({
            id: equipamentoId,
            equipamentoId,
            nome: nomeEquipamento,
            nomeEquipamento,
            quantidade: quantidadeEstoque,
            quantidadeEstoque,
            unidadeCobranca: equipamentoData.unidadeCobranca || "unidade",
            rotuloUnidadeCobranca:
                equipamentoData.rotuloUnidadeCobranca ||
                obterRotuloUnidadeCobranca(equipamentoData),
            permiteQuantidadeDecimal: Boolean(equipamentoData.permiteQuantidadeDecimal),
            valorHora: Number(equipamentoData.valorHora || 0),
            valorDia: Number(equipamentoData.valorDia || 0),
            valorMes: Number(equipamentoData.valorMes || 0),
        });
    }

    atualizarListaEquipamentos();

    preencherCampo("equipamentoSelect", "");

    const infoEquipamento = document.getElementById("infoEquipamento");

    if (infoEquipamento) {
        infoEquipamento.style.display = "none";
    }

    preencherCampo("quantidadeAlugar", 1);

    mostrarSucessoAluguel("Sucesso", "Equipamento reservado na lista!");
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
            const unidade = obterRotuloUnidadeCobranca(item);

            return `
        <tr>
          <td>
            <strong>${escaparHTMLAluguel(item.nomeEquipamento)}</strong>
          </td>
          <td>
            <strong>${Number(item.quantidadeEstoque || item.quantidade || 0)}</strong>
            <span class="linha-secundaria">unid. físicas</span>
          </td>

          <td>${escaparHTMLAluguel(unidade)}</td>

          <td>
            <span class="status-badge status-warning">
              A calcular na devolução
            </span>
          </td>
          <td>
            <button
              type="button"
              class="btn btn-small btn-danger"
              onclick="removerEquipamento(${index})"
            >
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
}

// ============================================
// REGISTRO DE ALUGUEL
// ============================================

function validarFormularioAluguel() {
    const clienteId = valorCampo("clienteSelect");
    const dataInicio = valorCampo("dataInicio");

    if (!clienteId) {
        return "Selecione um cliente.";
    }

    if (!dataInicio) {
        return "Informe a data de retirada.";
    }

    if (equipamentosSelecionados.length === 0) {
        return "Adicione pelo menos um equipamento.";
    }

    return null;
}

async function registrarAluguel(event) {
    event.preventDefault();

    const erro = validarFormularioAluguel();

    if (erro) {
        mostrarErroAluguel("Erro", erro);
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const textoOriginal = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
    }

    try {
        const clienteId = valorCampo("clienteSelect");
        const dataInicio = valorCampo("dataInicio");
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
            observacoes,
            equipamentos: equipamentosSelecionados,
        });

        mostrarSucessoAluguel(
            "Sucesso",
            "Retirada registrada. O valor será calculado na devolução."
        );

        limparFormularioAluguel();
        await carregarEquipamentosParaSelect();
        await carregarAlugueis();
        fecharModalAluguel();

        const btnImprimir = document.getElementById("btnImprimir");

        if (btnImprimir) {
            btnImprimir.dataset.aluguelId = aluguelId;
            btnImprimir.disabled = false;
            btnImprimir.style.display = "inline-flex";
        }
    } catch (error) {
        console.error("Erro ao registrar aluguel:", error);

        mostrarErroAluguel("Erro", "Erro ao registrar aluguel: " + error.message);
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
        <td colspan="8" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando aluguéis...</p>
        </td>
      </tr>
    `;

        alugueis = await AluguelService.listar();
        paginaAtualAlugueis = 1;

        renderizarTabelaAlugueis();
    } catch (error) {
        console.error("Erro ao carregar aluguéis:", error);

        alugueisList.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar aluguéis</p>
          <small>${escaparHTMLAluguel(error.message)}</small>
        </td>
      </tr>
    `;
    }
}

function obterAlugueisFiltrados() {
    const termo = normalizarTextoBusca(valorCampo("searchAlugueis"));

    if (!termo) {
        return alugueis;
    }

    return alugueis.filter((aluguel) => {
        const equipamentos = aluguel.equipamentosDetalhes || aluguel.equipamentos || [];

        const equipamentosTexto = equipamentos
            .map((item) => {
                return [
                    item.nomeEquipamento,
                    item.nome,
                    item.quantidadeEstoque,
                    item.quantidade,
                ].join(" ");
            })
            .join(" ");

        const textoAluguel = [
            aluguel.clienteNome,
            aluguel.clienteCelular,
            aluguel.clienteCpf,
            aluguel.clienteCPF,
            aluguel.dataInicio,
            aluguel.dataDevolucaoReal,
            aluguel.status,
            aluguel.statusPagamento,
            aluguel.formaPagamento,
            aluguel.valorTotal,
            aluguel.saldo,
            equipamentosTexto,
        ].join(" ");

        return normalizarTextoBusca(textoAluguel).includes(termo);
    });
}

function renderizarTabelaAlugueis() {
    const alugueisList = document.getElementById("alugueisList");

    if (!alugueisList) {
        return;
    }

    const alugueisFiltrados = obterAlugueisFiltrados();

    if (!alugueisFiltrados.length) {
        alugueisList.innerHTML = `
      <tr>
        <td colspan="8" class="empty-message">
          <i class="fas fa-file-contract"></i>
          <p>Nenhum aluguel encontrado</p>
        </td>
      </tr>
    `;

        renderizarPaginacaoAlugueis(0);
        return;
    }

    const totalPaginas = Math.ceil(alugueisFiltrados.length / ALUGUEIS_POR_PAGINA);

    if (paginaAtualAlugueis > totalPaginas) {
        paginaAtualAlugueis = totalPaginas;
    }

    const inicio = (paginaAtualAlugueis - 1) * ALUGUEIS_POR_PAGINA;
    const fim = inicio + ALUGUEIS_POR_PAGINA;
    const alugueisDaPagina = alugueisFiltrados.slice(inicio, fim);

    alugueisList.innerHTML = alugueisDaPagina
        .map((aluguel) => montarLinhaAluguel(aluguel))
        .join("");

    renderizarPaginacaoAlugueis(alugueisFiltrados.length);
}

function renderizarPaginacaoAlugueis(totalAlugueis) {
    const paginacao = document.getElementById("alugueisPaginacao");

    if (!paginacao) {
        return;
    }

    const totalPaginas = Math.ceil(totalAlugueis / ALUGUEIS_POR_PAGINA);

    if (totalPaginas <= 1) {
        paginacao.innerHTML = "";
        return;
    }

    const inicio = (paginaAtualAlugueis - 1) * ALUGUEIS_POR_PAGINA + 1;
    const fim = Math.min(paginaAtualAlugueis * ALUGUEIS_POR_PAGINA, totalAlugueis);

    paginacao.innerHTML = `
    <div class="pagination-info">
      Mostrando ${inicio} a ${fim} de ${totalAlugueis} aluguéis
    </div>
    <div class="pagination-actions">
      <button
        type="button"
        class="btn btn-secondary pagination-btn"
        onclick="mudarPaginaAlugueis(${paginaAtualAlugueis - 1})"
        ${paginaAtualAlugueis === 1 ? "disabled" : ""}
      >
        <i class="fas fa-chevron-left"></i> Anterior
      </button>
      <span class="pagination-current">
        Página ${paginaAtualAlugueis} de ${totalPaginas}
      </span>

      <button
        type="button"
        class="btn btn-secondary pagination-btn"
        onclick="mudarPaginaAlugueis(${paginaAtualAlugueis + 1})"
        ${paginaAtualAlugueis === totalPaginas ? "disabled" : ""}
      >
        Próxima <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  `;
}

function mudarPaginaAlugueis(novaPagina) {
    const totalAlugueis = obterAlugueisFiltrados().length;
    const totalPaginas = Math.ceil(totalAlugueis / ALUGUEIS_POR_PAGINA);

    if (novaPagina < 1 || novaPagina > totalPaginas) {
        return;
    }

    paginaAtualAlugueis = novaPagina;
    renderizarTabelaAlugueis();
}

window.mudarPaginaAlugueis = mudarPaginaAlugueis;

function montarLinhaAluguel(aluguel) {
    const equipamentos = aluguel.equipamentosDetalhes || aluguel.equipamentos || [];

    const equipamentosLista = equipamentos
        .map((e) => {
            const quantidade = Number(e.quantidadeEstoque || e.quantidade || 0);
            const nome = e.nomeEquipamento || e.nome || "Equipamento";
            return `${quantidade}x ${nome}`;
        })
        .join(", ");

    const equipamentosTexto = escaparHTMLAluguel(equipamentosLista);
    const equipamentosResumo =
        equipamentosTexto.length > 55
            ? equipamentosTexto.substring(0, 55) + "..."
            : equipamentosTexto;

    let statusClass = "status-available";
    let statusText = "Ativo";

    if (aluguel.status === "finalizado") {
        statusClass = "status-success";
        statusText = "Finalizado";
    } else if (aluguel.status === "cancelado") {
        statusClass = "status-unavailable";
        statusText = "Cancelado";
    }

    const pagamentoTexto =
        aluguel.status === "finalizado" ? obterTextoPagamento(aluguel) : "Pendente";

    const valorTexto =
        aluguel.status === "finalizado"
            ? formatarMoedaAluguel(aluguel.valorTotal || 0)
            : "<small>A calcular na devolução</small>";

    const botaoFinalizar =
        aluguel.status === "finalizado"
            ? `
        <button class="btn btn-small btn-secondary" disabled>
          <i class="fas fa-check"></i>
        </button>
      `
            : `
        <button
          class="btn btn-small btn-danger"
          onclick="abrirModalFechamento('${aluguel.id}')"
          title="Finalizar e calcular cobrança"
        >
          <i class="fas fa-clipboard-check"></i>
        </button>
      `;

    return `
    <tr>
      <td>
        <strong>${escaparHTMLAluguel(aluguel.clienteNome || "")}</strong>
        <br><small>${escaparHTMLAluguel(aluguel.clienteCelular || "")}</small>
      </td>
      <td>
        <small>${equipamentosResumo}</small>
      </td>

      <td>${formatarDataAluguel(aluguel.dataInicio)}</td>

      <td>${formatarDataAluguel(aluguel.dataDevolucaoReal)}</td>

      <td>${valorTexto}</td>

      <td>${pagamentoTexto}</td>

      <td>
        <span class="status-badge ${statusClass}">
          ${statusText}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
          <button
            class="btn btn-small btn-primary"
            onclick="visualizarAluguel('${aluguel.id}')"
            title="Visualizar"
          >
            <i class="fas fa-eye"></i>
          </button>

          <button
            class="btn btn-small btn-success"
            onclick="imprimirAluguel('${aluguel.id}')"
            title="Imprimir"
          >
            <i class="fas fa-print"></i>
          </button>

          ${botaoFinalizar}
        </div>
      </td>
    </tr>
  `;
}

function obterTextoPagamento(aluguel) {
    if (aluguel.statusPagamento === "pago") {
        return '<span class="status-badge status-success">Pago</span>';
    }

    if (aluguel.statusPagamento === "parcial") {
        return `<span class="status-badge status-warning">Parcial</span><br><small>Saldo: ${formatarMoedaAluguel(aluguel.saldo || 0)}</small>`;
    }

    return `<span class="status-badge status-unavailable">Pendente</span><br><small>Saldo: ${formatarMoedaAluguel(aluguel.saldo || aluguel.valorTotal || 0)}</small>`;
}

function buscarAlugueis() {
    paginaAtualAlugueis = 1;
    renderizarTabelaAlugueis();
}

// ============================================
// FECHAMENTO / DEVOLUÇÃO
// ============================================

function abrirModalFechamento(aluguelId) {
    const aluguel = alugueis.find((item) => item.id === aluguelId);

    if (!aluguel) {
        mostrarErroAluguel("Erro", "Aluguel não encontrado na lista.");
        return;
    }

    if (aluguel.status === "finalizado") {
        mostrarAvisoAluguel("Atenção", "Este aluguel já está finalizado.");
        return;
    }

    aluguelFechando = aluguel;

    preencherCampo("fechamentoCliente", aluguel.clienteNome || "-");
    preencherCampo("fechamentoDataInicio", formatarDataAluguel(aluguel.dataInicio));
    preencherCampo("dataDevolucaoReal", dataHojeISO());
    preencherCampo("periodoFechamento", "");
    preencherCampo("duracaoReal", 1);
    preencherCampo("descontoFechamento", "0,00");
    preencherCampo("acrescimoFechamento", "0,00");
    preencherCampo("valorPagoFechamento", "");
    preencherCampo("formaPagamentoFechamento", "");
    preencherCampo("observacoesFechamento", "");

    montarItensFechamento();

    const modal = document.getElementById("modalFechamento");

    if (modal) {
        modal.style.display = "flex";
    }

    recalcularFechamento();
}

function fecharModalFechamento() {
    const modal = document.getElementById("modalFechamento");

    if (modal) {
        modal.style.display = "none";
    }

    aluguelFechando = null;
}

function montarItensFechamento() {
    const tbody = document.getElementById("fechamentoItens");

    if (!tbody || !aluguelFechando) return;

    const equipamentos = aluguelFechando.equipamentosDetalhes || aluguelFechando.equipamentos || [];

    tbody.innerHTML = equipamentos
        .map((item, index) => {
            const quantidadeEstoque = Number(item.quantidadeEstoque || item.quantidade || 0);
            const unidade = obterRotuloUnidadeCobranca(item);
            const quantidadeCobradaPadrao = obterQuantidadeCobradaPadrao(item);

            return `
        <tr data-index="${index}">
          <td>
            <strong>${escaparHTMLAluguel(item.nomeEquipamento || item.nome)}</strong>
            <small class="linha-secundaria">Cobrança por ${escaparHTMLAluguel(unidade)}</small>
          </td>
          <td>
            <strong>${quantidadeEstoque}</strong>
            <small class="linha-secundaria">unid. físicas</small>
          </td>
          <td>
            <input
              type="text"
              class="fechamento-quantidade"
              data-index="${index}"
              value="${String(quantidadeCobradaPadrao).replace(".", ",")}"
            />
          </td>
          <td>
            <input
              type="text"
              class="fechamento-valor-unitario"
              data-index="${index}"
              value="0,00"
            />
          </td>
          <td>
            <strong class="fechamento-subtotal-item" data-index="${index}">
              R$ 0,00
            </strong>
          </td>
        </tr>
      `;
        })
        .join("");

    tbody
        .querySelectorAll(".fechamento-quantidade, .fechamento-valor-unitario")
        .forEach((input) => {
            input.addEventListener("input", recalcularFechamento);
            input.addEventListener("change", recalcularFechamento);
        });

    preencherValoresUnitariosPorPeriodo();
}

function preencherValoresUnitariosPorPeriodo() {
    if (!aluguelFechando) return;

    const periodo = valorCampo("periodoFechamento");
    const equipamentos = aluguelFechando.equipamentosDetalhes || aluguelFechando.equipamentos || [];

    document.querySelectorAll(".fechamento-valor-unitario").forEach((input) => {
        const index = Number(input.dataset.index);
        const item = equipamentos[index];

        if (!item || !periodo) {
            input.value = "0,00";
            return;
        }

        const valor = obterValorPorPeriodo(item, periodo);
        input.value = valor.toFixed(2).replace(".", ",");
    });
}

function recalcularFechamento() {
    if (!aluguelFechando) return;

    const periodo = valorCampo("periodoFechamento");
    const dataDevolucaoReal = valorCampo("dataDevolucaoReal");

    if (periodo && dataDevolucaoReal) {
        const duracaoCalculada = calcularDuracaoRealLocal(
            aluguelFechando.dataInicio,
            dataDevolucaoReal,
            periodo
        );

        const duracaoInput = document.getElementById("duracaoReal");

        if (
            duracaoInput &&
            (!duracaoInput.dataset.editadoManual ||
                duracaoInput.dataset.periodoAtual !== periodo ||
                duracaoInput.dataset.dataAtual !== dataDevolucaoReal)
        ) {
            duracaoInput.value = duracaoCalculada;
            duracaoInput.dataset.periodoAtual = periodo;
            duracaoInput.dataset.dataAtual = dataDevolucaoReal;
        }
    }

    const duracao = Math.max(1, parseInt(valorCampo("duracaoReal"), 10) || 1);

    let subtotal = 0;

    document.querySelectorAll("#fechamentoItens tr").forEach((linha) => {
        const index = linha.dataset.index;
        const quantidadeInput = linha.querySelector(".fechamento-quantidade");
        const valorInput = linha.querySelector(".fechamento-valor-unitario");
        const subtotalEl = linha.querySelector(".fechamento-subtotal-item");

        const quantidade = parseNumeroBR(quantidadeInput?.value || "0");
        const valorUnitario = parseNumeroBR(valorInput?.value || "0");
        const subtotalItem = quantidade * valorUnitario * duracao;

        subtotal += subtotalItem;

        if (subtotalEl) {
            subtotalEl.textContent = formatarMoedaAluguel(subtotalItem);
        }
    });

    const desconto = parseNumeroBR(valorCampo("descontoFechamento"));
    const acrescimo = parseNumeroBR(valorCampo("acrescimoFechamento"));
    const valorTotal = Math.max(0, subtotal + acrescimo - desconto);

    const valorPagoTexto = valorCampo("valorPagoFechamento");
    const valorPago = valorPagoTexto === "" ? valorTotal : parseNumeroBR(valorPagoTexto);

    const saldo = Math.max(0, valorTotal - valorPago);

    let statusPagamento = "Pendente";

    if (saldo <= 0) {
        statusPagamento = "Pago";
    } else if (valorPago > 0) {
        statusPagamento = "Parcial";
    }

    preencherCampo("subtotalFinalTexto", formatarMoedaAluguel(subtotal));
    preencherCampo("valorTotalFinalTexto", formatarMoedaAluguel(valorTotal));
    preencherCampo("saldoFinalTexto", formatarMoedaAluguel(saldo));
    preencherCampo("statusPagamentoTexto", statusPagamento);
}

document.addEventListener("input", function (event) {
    if (event.target && event.target.id === "duracaoReal") {
        event.target.dataset.editadoManual = "true";
    }
});

document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "periodoFechamento") {
        const duracaoInput = document.getElementById("duracaoReal");

        if (duracaoInput) {
            delete duracaoInput.dataset.editadoManual;
        }

        preencherValoresUnitariosPorPeriodo();
        recalcularFechamento();
    }
});

async function confirmarFechamentoAluguel() {
    if (!aluguelFechando) {
        mostrarErroAluguel("Erro", "Nenhum aluguel selecionado para fechamento.");
        return;
    }

    const dataDevolucaoReal = valorCampo("dataDevolucaoReal");
    const periodo = valorCampo("periodoFechamento");
    const duracaoReal = parseInt(valorCampo("duracaoReal"), 10) || 0;

    if (!dataDevolucaoReal) {
        mostrarErroAluguel("Erro", "Informe a data real de devolução.");
        return;
    }

    if (!periodo) {
        mostrarErroAluguel("Erro", "Selecione o tipo de cobrança no fechamento.");
        return;
    }

    if (duracaoReal <= 0) {
        mostrarErroAluguel("Erro", "Informe uma duração real válida.");
        return;
    }

    const equipamentos = aluguelFechando.equipamentosDetalhes || aluguelFechando.equipamentos || [];
    const itensFechamento = [];

    let erroItem = null;

    document.querySelectorAll("#fechamentoItens tr").forEach((linha) => {
        if (erroItem) return;

        const index = Number(linha.dataset.index);
        const item = equipamentos[index];
        const quantidadeInput = linha.querySelector(".fechamento-quantidade");
        const valorInput = linha.querySelector(".fechamento-valor-unitario");

        const quantidadeCobradaFinal = parseNumeroBR(quantidadeInput?.value || "0");
        const valorUnitarioFinal = parseNumeroBR(valorInput?.value || "0");

        if (!item) {
            erroItem = "Item de fechamento inválido.";
            return;
        }

        if (quantidadeCobradaFinal <= 0) {
            erroItem = `Quantidade cobrada inválida para "${item.nomeEquipamento || item.nome}".`;
            return;
        }

        if (valorUnitarioFinal <= 0) {
            erroItem = `Valor unitário inválido para "${item.nomeEquipamento || item.nome}".`;
            return;
        }

        itensFechamento.push({
            equipamentoId: item.equipamentoId || item.id,
            quantidadeCobradaFinal,
            valorUnitarioFinal,
        });
    });

    if (erroItem) {
        mostrarErroAluguel("Erro", erroItem);
        return;
    }

    const btnConfirmar = document.getElementById("btnConfirmarFechamento");
    const textoOriginal = btnConfirmar ? btnConfirmar.innerHTML : "";

    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fechando...';
    }

    try {
        await AluguelService.finalizar(aluguelFechando.id, {
            dataDevolucaoReal,
            periodo,
            duracaoReal,
            itensFechamento,
            desconto: parseNumeroBR(valorCampo("descontoFechamento")),
            acrescimo: parseNumeroBR(valorCampo("acrescimoFechamento")),
            valorPago:
                valorCampo("valorPagoFechamento") === ""
                    ? undefined
                    : parseNumeroBR(valorCampo("valorPagoFechamento")),
            formaPagamento: valorCampo("formaPagamentoFechamento"),
            observacoesFechamento: valorCampo("observacoesFechamento"),
        });

        mostrarSucessoAluguel(
            "Sucesso",
            "Aluguel finalizado, estoque devolvido e cobrança calculada."
        );

        fecharModalFechamento();
        await carregarEquipamentosParaSelect();
        await carregarAlugueis();
        fecharModalAluguel();
    } catch (error) {
        console.error("Erro ao finalizar aluguel:", error);

        mostrarErroAluguel("Erro", "Erro ao finalizar aluguel: " + error.message);
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
        mostrarErroAluguel("Erro", "Aluguel não encontrado na lista.");
        return;
    }

    const equipamentos = aluguel.equipamentosDetalhes || aluguel.equipamentos || [];

    const listaEquipamentos = equipamentos
        .map((item) => {
            const quantidadeEstoque = item.quantidadeEstoque || item.quantidade || 0;
            const quantidadeCobrada = item.quantidadeCobradaFinal || item.quantidadeCobrada || "-";
            const unidade = obterRotuloUnidadeCobranca(item);

            return (
                `${quantidadeEstoque}x ${item.nomeEquipamento || item.nome}` +
                ` | Cobrança: ${quantidadeCobrada} ${unidade}`
            );
        })
        .join("\n");

    alert(
        `Cliente: ${aluguel.clienteNome || ""}\n` +
            `Retirada: ${formatarDataAluguel(aluguel.dataInicio)}\n` +
            `Devolução: ${formatarDataAluguel(aluguel.dataDevolucaoReal)}\n` +
            `Status: ${aluguel.status || ""}\n` +
            `Período final: ${obterTextoPeriodo(aluguel.periodo || aluguel.periodoFinal)}\n` +
            `Duração real: ${aluguel.duracaoReal || "-"}\n` +
            `Valor total: ${
                aluguel.status === "finalizado"
                    ? formatarMoedaAluguel(aluguel.valorTotal || 0)
                    : "A calcular na devolução"
            }\n` +
            `Valor pago: ${formatarMoedaAluguel(aluguel.valorPago || 0)}\n` +
            `Saldo: ${formatarMoedaAluguel(aluguel.saldo || 0)}\n\n` +
            `Equipamentos:\n${listaEquipamentos}`
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
    preencherCampo("quantidadeAlugar", 1);
    preencherCampo("observacoesAluguel", "");

    const secoesParaOcultar = ["infoCliente", "infoEquipamento", "listaEquipamentosContainer"];

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

    carregarClientesParaSelect();
    carregarEquipamentosParaSelect();

    const modalAluguel = document.getElementById("aluguelModal");

    if (modalAluguel?.classList.contains("active")) {
        document.getElementById("clienteSelect")?.focus();
    }
}

document.addEventListener("click", function (event) {
    const modal = document.getElementById("aluguelModal");

    if (event.target === modal) {
        fecharModalAluguel();
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        const modalFechamento = document.getElementById("modalFechamento");

        if (modalFechamento?.style.display === "flex") {
            return;
        }

        fecharModalAluguel();
    }
});
