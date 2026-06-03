document.addEventListener("DOMContentLoaded", function () {
    iniciarPaginaImpressao();
});

async function iniciarPaginaImpressao() {
    const loadingElement = document.getElementById("loading");
    const container = document.getElementById("contractContainer");

    try {
        const firestore = obterFirestore();
        const aluguelId = obterAluguelId();

        if (!aluguelId) {
            throw new Error(
                "ID do aluguel não informado. Abra o contrato a partir da página de aluguéis."
            );
        }

        localStorage.removeItem("aluguelParaImprimir");

        const aluguel = await carregarAluguel(firestore, aluguelId);
        const cliente = await carregarCliente(firestore, aluguel.clienteId || aluguel.cliente?.id);
        const equipamentosDetalhados = await carregarEquipamentosDetalhados(
            firestore,
            aluguel.equipamentos || []
        );

        if (loadingElement) {
            loadingElement.remove();
        }

        container.innerHTML = gerarContratoHTML(aluguel, cliente, equipamentosDetalhados);
    } catch (error) {
        console.error("Erro ao carregar contrato:", error);

        if (loadingElement) {
            loadingElement.remove();
        }

        if (container) {
            container.innerHTML = `
                <div class="error">
                    <div class="error-title">Erro ao carregar contrato</div>
                    <p>${escaparHTML(error.message || "Não foi possível carregar o contrato.")}</p>
                    <p style="margin-top: 20px;">
                        <button onclick="window.history.back()" class="btn btn-secondary">
                            Voltar
                        </button>
                    </p>
                </div>
            `;
        }
    }
}

// ============================================
// INICIALIZAÇÃO DO FIRESTORE
// ============================================

function obterFirestore() {
    if (typeof db !== "undefined" && db && typeof db.collection === "function") {
        return db;
    }

    if (typeof firebase !== "undefined" && firebase.firestore) {
        return firebase.firestore();
    }

    throw new Error(
        "Firestore não foi inicializado. Verifique se firebase-config.js foi carregado antes de imprimir.js."
    );
}

function obterAluguelId() {
    const params = new URLSearchParams(window.location.search);

    return (
        params.get("id") ||
        params.get("aluguelId") ||
        params.get("aluguel") ||
        localStorage.getItem("aluguelParaImprimir") ||
        ""
    );
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function carregarAluguel(firestore, aluguelId) {
    const doc = await firestore.collection("alugueis").doc(aluguelId).get();

    if (!doc.exists) {
        throw new Error("Aluguel não encontrado no banco de dados.");
    }

    const dados = doc.data();

    return {
        id: doc.id,

        // número sequencial do aluguel
        numeroAluguel: dados.numeroAluguel || null,
        codigoContrato: dados.codigoContrato || "",
        clienteId: dados.clienteId || dados.cliente?.id || "",
        clienteNome: dados.clienteNome || dados.cliente?.nome || "",
        clienteCelular: dados.clienteCelular || dados.cliente?.celular || "",
        clienteCpf: dados.clienteCpf || dados.cliente?.cpf || "",
        dataInicio: dados.dataInicio || "",
        dataDevolucaoPrevista: dados.dataDevolucaoPrevista || dados.dataFim || "",
        dataDevolucaoReal: dados.dataDevolucaoReal || "",
        status: dados.status || "ativo",
        statusPagamento: dados.statusPagamento || "pendente",
        observacoes: dados.observacoes || "",
        equipamentos: dados.equipamentos || [],
        periodo: dados.periodo || dados.periodoFinal || "",
        duracaoReal: dados.duracaoReal || null,
        valorTotal: dados.valorTotal || null,
        valorPago: dados.valorPago || null,
        saldo: dados.saldo || null,
        formaPagamento: dados.formaPagamento || "",
        desconto: dados.desconto || 0,
        acrescimo: dados.acrescimo || 0,
        observacoesFechamento: dados.observacoesFechamento || "",
    };
}

async function carregarCliente(firestore, clienteId) {
    if (!clienteId) {
        return criarClienteFallback();
    }

    try {
        const doc = await firestore.collection("clientes").doc(clienteId).get();

        if (!doc.exists) {
            return criarClienteFallback();
        }

        return {
            id: doc.id,
            ...doc.data(),
        };
    } catch (error) {
        console.error("Erro ao carregar cliente:", error);
        return criarClienteFallback();
    }
}

function criarClienteFallback() {
    return {
        nome: "Cliente não encontrado",
        cpf: "",
        cnpj: "",
        identidade: "",
        rg: "",
        dataNascimento: "",
        telefone: "",
        celular: "",
        email: "",
        endereco: "",
        bairro: "",
        cidade: "",
        estado: "",
        cep: "",
    };
}

async function carregarEquipamentosDetalhados(firestore, equipamentos) {
    if (!Array.isArray(equipamentos) || equipamentos.length === 0) {
        return [];
    }

    const promessas = equipamentos.map(async function (item) {
        const equipamentoId = item.equipamentoId || item.id;

        if (!equipamentoId) {
            return {
                ...item,
                detalhes: {},
            };
        }

        try {
            const doc = await firestore.collection("equipamentos").doc(equipamentoId).get();

            return {
                ...item,
                detalhes: doc.exists ? doc.data() : {},
            };
        } catch (error) {
            console.error("Erro ao carregar equipamento:", equipamentoId, error);

            return {
                ...item,
                detalhes: {},
            };
        }
    });

    return Promise.all(promessas);
}

// ============================================
// GERAÇÃO DO HTML DO CONTRATO
// ============================================

function gerarContratoHTML(aluguel, cliente, equipamentos) {
    const codigoContrato = gerarCodigoContrato(aluguel);
    const status = aluguel.status || "ativo";
    const finalizado = status === "finalizado";

    return `
        <div class="contract-header">
            <div>
                <div class="company-name">OUROGUEL LTDA</div>
                <div class="company-subtitle">LOCAÇÃO E VENDAS DE ANDAIMES, ESCADAS, MÁQUINAS E FERRAMENTAS EM GERAL</div>
                <div class="company-info">
                    CNPJ: 03.580.915/0001-01 | Telefone: (31) 3742-1190<br>
                    Rua Amaro Lanari, n° 300, bairro Pioneiros - Ouro Branco/MG
                </div>
            </div>
            <div class="contract-badge">
                <span>CONTRATO Nº</span>
                <strong>${escaparHTML(codigoContrato)}</strong>
            </div>
        </div>
        <div class="document-title">
            CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS
        </div>
        <!-- STATUS DO ALUGUEL -->
        <div class="section">
            <div class="section-title">SITUAÇÃO DO CONTRATO</div>
            <table class="info-table">
                <tr>
                    <td class="label">Status:</td>
                    <td colspan="3">
                        ${gerarBadgeStatus(status)}
                    </td>
                </tr>
                ${
                    aluguel.observacoes
                        ? `
                <tr>
                    <td class="label">Observações:</td>
                    <td colspan="3">${escaparHTML(aluguel.observacoes)}</td>
                </tr>
                `
                        : ""
                }
            </table>
        </div>
        <!-- DADOS DO CLIENTE -->
        <div class="section">
            <div class="section-title">DADOS DO LOCATÁRIO</div>
            <table class="info-table">
                <tr>
                    <td class="label">Nome Completo:</td>
                    <td colspan="3"><strong>${escaparHTML(cliente.nome || aluguel.clienteNome || "Não informado")}</strong></td>
                </tr>
                <tr>
                    <td class="label">CPF/CNPJ:</td>
                    <td>${escaparHTML(cliente.cpf || aluguel.clienteCpf || "Não informado")}</td>
                    <td class="label">RG:</td>
                    <td>${escaparHTML(cliente.rg || cliente.identidade || "Não informado")}</td>
                </tr>
                <tr>
                    <td class="label">Telefone:</td>
                    <td>${escaparHTML(cliente.telefone || cliente.celular || aluguel.clienteCelular || "Não informado")}</td>
                    <td class="label">E-mail:</td>
                    <td>${escaparHTML(cliente.email || "Não informado")}</td>
                </tr>
                <tr>
                    <td class="label">Endereço:</td>
                    <td colspan="3">${escaparHTML(formatarEndereco(cliente))}</td>
                </tr>
            </table>
        </div>
        <!-- DATAS -->
        <div class="section">
            <div class="section-title">DATAS</div>
            <table class="info-table">
                <tr>
                    <td class="label">Data de Retirada:</td>
                    <td><strong>${formatarData(aluguel.dataInicio)}</strong></td>
                    <td class="label">Devolução Prevista:</td>
                    <td>${formatarData(aluguel.dataDevolucaoPrevista || aluguel.dataFim || "Não definida")}</td>
                </tr>
                ${
                    finalizado
                        ? `
                <tr>
                    <td class="label">Devolução Real:</td>
                    <td>${formatarData(aluguel.dataDevolucaoReal)}</td>
                    <td class="label">Duração Real:</td>
                    <td>${formatarDuracao(aluguel.duracaoReal, aluguel.periodo)}</td>
                </tr>
                `
                        : `
                <tr>
                    <td class="label">Devolução Real:</td>
                    <td colspan="3"><em>Aguardando devolução</em></td>
                </tr>
                `
                }
            </table>
        </div>
        <!-- EQUIPAMENTOS RETIRADOS -->
        <div class="section">
            <div class="section-title">EQUIPAMENTOS RETIRADOS</div>
            <table class="equipment-table">
                <thead>
                    <tr>
                        <th width="45%">Descrição do Equipamento</th>
                        <th width="15%">Qtd. Física</th>
                        <th width="20%">Unidade de Cobrança</th>
                        <th width="20%">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${gerarLinhasEquipamentos(equipamentos, finalizado)}
                </tbody>
            </table>
        </div>

        ${finalizado ? gerarSecaoFinanceira(aluguel) : gerarAvisoCalculo()}
<!-- TERMOS E CONDIÇÕES -->
<div class="section">
    <div class="section-title">TERMOS E CONDIÇÕES</div>
    <div class="terms">
        <ul>
            <li>
                O locatário declara ter recebido os equipamentos em boas condições de uso,
                conservação, funcionamento e limpeza, após conferência no ato da retirada.
            </li>
            <li>
                O equipamento deverá ser utilizado exclusivamente para a finalidade compatível
                com sua natureza, sendo proibido o uso inadequado, abusivo ou diverso daquele
                para o qual foi locado.
            </li>
            <li>
                O locatário se responsabiliza pela guarda, conservação, transporte e uso correto
                dos equipamentos durante todo o período da locação.
            </li>
            <li>
                O equipamento deverá ser devolvido em perfeitas condições de uso e limpeza,
                salvo desgaste natural decorrente da utilização regular.
            </li>
            <li>
                A devolução será registrada com <strong>data real</strong> e a cobrança será
                calculada conforme o período definido pelo locador.
            </li>
            <li>
                Atrasos na devolução poderão gerar cobrança proporcional ao período excedente,
                conforme a tabela de preços vigente da locadora.
            </li>
            <li>
                O valor da locação será calculado <strong>no momento da devolução</strong>,
                conforme período efetivamente utilizado e tabela vigente.
            </li>
            <li>
                Danos, quebras, perdas, furtos, roubos ou extravios são de
                <strong>total responsabilidade do locatário</strong>.
            </li>
            <li>
                Em caso de perda, extravio, furto, roubo ou dano total, o locatário deverá pagar
                o valor de reposição integral do equipamento.
            </li>
            <li>
                Em caso de dano parcial, o locatário deverá arcar com os custos de reparo,
                peças, mão de obra, transporte técnico e demais despesas necessárias para
                restaurar o equipamento.
            </li>
            <li>
                Caso o equipamento seja devolvido sujo, com resíduos, concreto, tinta, óleo,
                terra ou qualquer material que exija limpeza extraordinária, poderá ser cobrada
                taxa adicional de limpeza.
            </li>
            <li>
                É proibida a sublocação, cessão, empréstimo ou transferência do equipamento
                a terceiros sem autorização prévia por escrito da locadora.
            </li>
            <li>
                É proibido desmontar, adulterar, modificar, remover peças, retirar etiquetas de
                identificação, lacres ou realizar qualquer intervenção técnica no equipamento
                sem autorização da locadora.
            </li>
            <li>
                O locatário deverá comunicar imediatamente à locadora qualquer defeito, dano,
                acidente, perda, furto, roubo ou irregularidade envolvendo o equipamento.
            </li>
            <li>
                A continuidade do uso do equipamento após a identificação de defeito ou
                funcionamento anormal será considerada uso indevido, podendo gerar
                responsabilidade por danos adicionais.
            </li>
            <li>
                A locadora não se responsabiliza por acidentes, prejuízos, danos materiais ou
                pessoais decorrentes do uso inadequado, imprudente, negligente ou contrário
                às orientações de uso do equipamento.
            </li>
            <li>
                A locação somente será considerada encerrada após a devolução efetiva dos
                equipamentos e conferência pela locadora.
            </li>
            <li>
                A assinatura deste contrato confirma a ciência e concordância do locatário com
                os equipamentos locados, quantidades, valores, prazo de devolução e condições
                gerais da locação.
            </li>
        </ul>
        <div class="warning">
            <strong>ATENÇÃO:</strong> Confira os equipamentos no ato da retirada.
            Ao assinar, o locatário declara que recebeu os itens descritos neste contrato
            em perfeito estado de uso, conservação e funcionamento.
        </div>
    </div>
</div>
        <!-- ASSINATURAS -->
        <div class="section">
            <div class="section-title">ASSINATURAS</div>
            <div class="signatures">
                <div class="signature-box">
                    <strong>LOCADOR (OUROGUEL LTDA)</strong>
                    ______________________________
                    <p>Responsável pela entrega</p>
                </div>
                <div class="signature-box">
                    <strong>LOCATÁRIO</strong>
                    ______________________________
                    <p>${escaparHTML(cliente.nome || aluguel.clienteNome || "Nome do Cliente")}</p>
                    <p>CPF: ${escaparHTML(cliente.cpf || aluguel.clienteCpf || "")}</p>
                </div>
            </div>
        </div>
        <!-- RODAPÉ -->
        <div class="footer">
            <p>
                <strong>OUROGUEL LTDA</strong> | Locação de Equipamentos<br>
                Documento gerado pelo Sistema Ouroguel
            </p>
        </div>
        <div class="timestamp">
            Documento emitido em: ${new Date().toLocaleString("pt-BR")}
        </div>
    `;
}

// ============================================
// SEÇÕES AUXILIARES DO CONTRATO
// ============================================

function gerarBadgeStatus(status) {
    const statusNormalizado = String(status || "").toLowerCase();

    const mapaClasses = {
        ativo: "status-ativo",
        finalizado: "status-finalizado",
        cancelado: "status-cancelado",
    };

    const mapaTextos = {
        ativo: "ATIVO - Em andamento",
        finalizado: "FINALIZADO - Devolvido",
        cancelado: "CANCELADO",
    };

    const classe = mapaClasses[statusNormalizado] || "status-ativo";
    const texto = mapaTextos[statusNormalizado] || status;

    return `<span class="status-badge ${classe}">${texto}</span>`;
}

function gerarAvisoCalculo() {
    return `
        <div class="section">
            <div class="section-title">VALORES</div>
            <div class="warning-box">
                <strong>IMPORTANTE:</strong> O valor da locação será calculado no momento da devolução,
                conforme o período real de uso e a unidade de cobrança de cada equipamento
                (hora, dia ou mês).
            </div>
        </div>
    `;
}

function gerarSecaoFinanceira(aluguel) {
    const periodo = aluguel.periodo || "";
    const duracao = aluguel.duracaoReal || 0;
    const valorTotal = aluguel.valorTotal || 0;
    const desconto = aluguel.desconto || 0;
    const acrescimo = aluguel.acrescimo || 0;
    const valorPago = aluguel.valorPago || 0;
    const saldo = aluguel.saldo || 0;
    const statusPagamento = aluguel.statusPagamento || "pendente";

    let statusPagamentoTexto = "Pendente";
    let statusPagamentoClasse = "status-ativo";

    if (statusPagamento === "pago" || saldo <= 0) {
        statusPagamentoTexto = "PAGO";
        statusPagamentoClasse = "status-finalizado";
    } else if (statusPagamento === "parcial" || valorPago > 0) {
        statusPagamentoTexto = "PAGO PARCIALMENTE";
        statusPagamentoClasse = "status-ativo";
    }

    return `
        <div class="section">
            <div class="section-title">RESUMO DA COBRANÇA</div>
            <table class="info-table">
                <tr>
                    <td class="label">Tipo de Cobrança:</td>
                    <td>${obterTextoPeriodo(periodo)}</td>
                    <td class="label">Duração Real:</td>
                    <td>${formatarDuracao(duracao, periodo)}</td>
                </tr>
                <tr>
                    <td class="label">Valor Total:</td>
                    <td><strong>${formatarMoeda(valorTotal)}</strong></td>
                    <td class="label">Status Pagamento:</td>
                    <td><span class="status-badge ${statusPagamentoClasse}">${statusPagamentoTexto}</span></td>
                </tr>
                ${
                    desconto > 0
                        ? `
                <tr>
                    <td class="label">Desconto:</td>
                    <td>${formatarMoeda(desconto)}</td>
                </tr>
                `
                        : ""
                }
                ${
                    acrescimo > 0
                        ? `
                <tr>
                    <td class="label">Acréscimo:</td>
                    <td>${formatarMoeda(acrescimo)}</td>
                </tr>
                `
                        : ""
                }
                <tr>
                    <td class="label">Valor Pago:</td>
                    <td>${formatarMoeda(valorPago)}</td>
                    <td class="label">Saldo:</td>
                    <td><strong>${formatarMoeda(saldo)}</strong></td>
                </tr>
                ${
                    aluguel.formaPagamento
                        ? `
                <tr>
                    <td class="label">Forma de Pagamento:</td>
                    <td colspan="3">${escaparHTML(aluguel.formaPagamento)}</td>
                </tr>
                `
                        : ""
                }
                ${
                    aluguel.observacoesFechamento
                        ? `
                <tr>
                    <td class="label">Obs. Fechamento:</td>
                    <td colspan="3">${escaparHTML(aluguel.observacoesFechamento)}</td>
                </tr>
                `
                        : ""
                }
            </table>
        </div>
    `;
}

function gerarLinhasEquipamentos(equipamentos, finalizado) {
    if (!Array.isArray(equipamentos) || equipamentos.length === 0) {
        return `
            <tr>
                <td colspan="4">Nenhum equipamento registrado neste contrato.</td>
            </tr>
        `;
    }

    return equipamentos
        .map(function (item) {
            const detalhes = item.detalhes || {};

            const nome =
                item.nomeEquipamento || item.nome || detalhes.nomeEquipamento || "Equipamento";

            // Quantidade física (estoque/unidades)
            const quantidadeFisica = item.quantidadeEstoque || item.quantidade || 1;

            // Unidade de cobrança
            const unidadeCobranca = item.unidadeCobranca || detalhes.unidadeCobranca || "unidade";
            const rotuloUnidade = obterRotuloUnidadeCobranca(item);

            // Se finalizado, mostrar quantidade cobrada
            let infoCobranca = "";
            if (finalizado) {
                const qtdCobrada = item.quantidadeCobradaFinal || item.quantidadeCobrada || "-";
                infoCobranca = `<br><small>Cobrado: ${qtdCobrada} ${rotuloUnidade}</small>`;
            }

            const statusItem = finalizado ? "Devolvido" : "Em locação";

            return `
                <tr>
                    <td>
                        <span class="equipment-name">${escaparHTML(nome)}</span>
                        ${infoCobranca}
                    </td>
                    <td><strong>${quantidadeFisica}</strong> unid.</td>
                    <td>${escaparHTML(rotuloUnidade)}</td>
                    <td>${statusItem}</td>
                </tr>
            `;
        })
        .join("");
}

// ============================================
// FUNÇÕES DE FORMATAÇÃO
// ============================================

function obterRotuloUnidadeCobranca(item) {
    if (item.rotuloUnidadeCobranca) return item.rotuloUnidadeCobranca;

    const unidade = (item.unidadeCobranca || "unidade").toLowerCase();

    const rotulos = {
        unidade: "unidade",
        metro: "metro",
        m: "m",
        metro2: "m²",
        m2: "m²",
        duzia: "dúzia",
        conjunto: "conjunto",
        jogo: "jogo",
        quilo: "kg",
        kg: "kg",
        dosagem: "200 ml",
    };

    return rotulos[unidade] || "unidade";
}

function obterTextoPeriodo(periodo) {
    if (!periodo) return "Não definido";

    const periodoNormalizado = String(periodo).toLowerCase();

    if (periodoNormalizado.includes("hora")) return "Por Hora";
    if (periodoNormalizado.includes("dia")) return "Por Dia";
    if (periodoNormalizado.includes("mes") || periodoNormalizado.includes("mês")) return "Por Mês";

    return periodo;
}

function formatarDuracao(duracao, periodo) {
    if (!duracao || duracao <= 0) return "-";

    const valor = Number(duracao);
    const periodoNormalizado = String(periodo || "").toLowerCase();

    if (periodoNormalizado.includes("hora")) {
        return valor + " " + (valor === 1 ? "hora" : "horas");
    }

    if (periodoNormalizado.includes("mes") || periodoNormalizado.includes("mês")) {
        return valor + " " + (valor === 1 ? "mês" : "meses");
    }

    return valor + " " + (valor === 1 ? "dia" : "dias");
}

function gerarCodigoContrato(aluguel) {
    if (aluguel.codigoContrato) {
        return aluguel.codigoContrato;
    }

    const dataBase = converterParaData(aluguel.dataInicio) || new Date();
    const ano = dataBase.getFullYear();
    const mes = String(dataBase.getMonth() + 1).padStart(2, "0");

    if (aluguel.numeroAluguel) {
        const numero = String(aluguel.numeroAluguel).padStart(2, "0");
        return `CT-${ano}${mes}-${numero}`;
    }

    return `CT-${ano}${mes}-SEM-NUMERO`;
}

function formatarEndereco(cliente) {
    const partes = [];

    if (cliente.endereco) partes.push(cliente.endereco);
    if (cliente.bairro) partes.push(cliente.bairro);

    const cidadeEstado = [cliente.cidade, cliente.estado].filter(Boolean).join("/");
    if (cidadeEstado) partes.push(cidadeEstado);

    if (cliente.cep) partes.push("CEP: " + cliente.cep);

    return partes.length ? partes.join(" - ") : "Não informado";
}

function converterParaData(valor) {
    if (!valor) return null;

    if (valor instanceof Date) {
        return isNaN(valor.getTime()) ? null : valor;
    }

    if (typeof valor === "object" && typeof valor.toDate === "function") {
        return valor.toDate();
    }

    if (typeof valor === "object" && valor.seconds) {
        return new Date(valor.seconds * 1000);
    }

    if (typeof valor === "string") {
        const matchISO = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        if (matchISO) {
            return new Date(Number(matchISO[1]), Number(matchISO[2]) - 1, Number(matchISO[3]));
        }

        const data = new Date(valor);
        return isNaN(data.getTime()) ? null : data;
    }

    return null;
}

function formatarData(valor) {
    const data = converterParaData(valor);

    if (!data) return "Não informada";

    return data.toLocaleDateString("pt-BR");
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number(valor || 0));
}

function escaparHTML(valor) {
    return String(valor === null || valor === undefined ? "" : valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
