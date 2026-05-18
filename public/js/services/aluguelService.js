(function () {
  async function aguardarFirebase() {
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

  function dataHojeISO() {
    const hoje = new Date();
    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
    return hoje.toISOString().split("T")[0];
  }

  function calcularDuracaoPorDatas(dataInicio, dataFim, periodo) {
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

      if (fim.getDate() > inicio.getDate()) {
        meses += 1;
      }

      return Math.max(1, meses);
    }

    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
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

  function validarDadosAbertura(dados) {
    if (!dados.clienteId) {
      throw new Error("Cliente não informado.");
    }

    if (!dados.cliente) {
      throw new Error("Dados do cliente não informados.");
    }

    if (!dados.dataInicio) {
      throw new Error("Data de início não informada.");
    }

    if (!Array.isArray(dados.equipamentos) || dados.equipamentos.length === 0) {
      throw new Error("Nenhum equipamento informado.");
    }
  }

  function normalizarItemFechamento(item) {
    return {
      equipamentoId: item.equipamentoId || item.id,
      quantidadeCobradaFinal: Number(item.quantidadeCobradaFinal || 0),
      valorUnitarioFinal: Number(
        item.valorUnitarioFinal || item.valorUnitario || 0,
      ),
    };
  }

  window.AluguelService = {
    async listar() {
      const db = await aguardarFirebase();

      const snapshot = await db
        .collection("alugueis")
        .orderBy("dataRegistro", "desc")
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },

    async obterPorId(aluguelId) {
      const db = await aguardarFirebase();

      const doc = await db.collection("alugueis").doc(aluguelId).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
      };
    },

    async registrar(dados) {
      validarDadosAbertura(dados);

      const db = await aguardarFirebase();
      const aluguelRef = db.collection("alugueis").doc();

      await db.runTransaction(async function (transaction) {
        const equipamentoRefs = dados.equipamentos.map((item) =>
          db.collection("equipamentos").doc(item.id || item.equipamentoId),
        );

        const equipamentoDocs = [];

        for (const ref of equipamentoRefs) {
          equipamentoDocs.push(await transaction.get(ref));
        }

        const equipamentosDetalhes = [];

        for (let i = 0; i < dados.equipamentos.length; i++) {
          const itemSelecionado = dados.equipamentos[i];
          const equipamentoDoc = equipamentoDocs[i];

          if (!equipamentoDoc.exists) {
            throw new Error(
              `Equipamento ${
                itemSelecionado.nomeEquipamento || itemSelecionado.nome || ""
              } não encontrado.`,
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
          const quantidadeSolicitada = Number(
            itemSelecionado.quantidadeEstoque ||
              itemSelecionado.quantidade ||
              0,
          );

          if (quantidadeSolicitada <= 0) {
            throw new Error(
              `Quantidade inválida para "${equipamentoAtual.nomeEquipamento}".`,
            );
          }

          if (quantidadeSolicitada > quantidadeDisponivel) {
            throw new Error(
              `Estoque insuficiente para "${equipamentoAtual.nomeEquipamento}". Disponível: ${quantidadeDisponivel}.`,
            );
          }

          const equipamentoId =
            itemSelecionado.id || itemSelecionado.equipamentoId;
          const nomeEquipamento =
            equipamentoAtual.nomeEquipamento ||
            itemSelecionado.nomeEquipamento ||
            itemSelecionado.nome ||
            "Equipamento";

          equipamentosDetalhes.push({
            equipamentoId,
            nome: nomeEquipamento,
            nomeEquipamento,

            quantidade: quantidadeSolicitada,
            quantidadeEstoque: quantidadeSolicitada,

            unidadeCobranca:
              itemSelecionado.unidadeCobranca ||
              equipamentoAtual.unidadeCobranca ||
              "unidade",
            rotuloUnidadeCobranca:
              itemSelecionado.rotuloUnidadeCobranca ||
              equipamentoAtual.rotuloUnidadeCobranca ||
              "unid.",
            permiteQuantidadeDecimal: Boolean(
              itemSelecionado.permiteQuantidadeDecimal ||
              equipamentoAtual.permiteQuantidadeDecimal,
            ),

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

        transaction.set(aluguelRef, {
          clienteId: dados.clienteId,
          clienteNome: dados.cliente.nome || "",
          clienteCpf: dados.cliente.cpf || "",
          clienteCelular: dados.cliente.celular || "",
          clienteTelefone: dados.cliente.telefone || "",

          dataInicio: dados.dataInicio,
          dataRetirada: dados.dataInicio,
          dataDevolucaoPrevista: dados.dataDevolucaoPrevista || "",

          equipamentosIds: equipamentosDetalhes.map(
            (item) => item.equipamentoId,
          ),
          equipamentos: equipamentosDetalhes,
          equipamentosDetalhes,

          observacoes: dados.observacoes || "",

          subtotal: 0,
          desconto: 0,
          acrescimo: 0,
          valorTotal: 0,
          valorPago: 0,
          saldo: 0,
          statusPagamento: "nao_calculado",
          cobrancaCalculada: false,

          status: "ativo",
          dataRegistro: new Date().toISOString(),
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          criadoPor: window.auth?.currentUser?.uid || null,
        });
      });

      return aluguelRef.id;
    },

    async finalizar(aluguelId, fechamento = {}) {
      const db = await aguardarFirebase();
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

        const periodoCobranca =
          fechamento.periodoCobranca || fechamento.periodo;

        if (!["hora", "dia", "mes"].includes(periodoCobranca)) {
          throw new Error("Informe o tipo de cobrança: hora, dia ou mês.");
        }

        const dataDevolucaoReal = fechamento.dataDevolucaoReal || dataHojeISO();
        const duracaoCobranca = Number(
          fechamento.duracaoCobranca ||
            fechamento.duracaoReal ||
            calcularDuracaoPorDatas(
              aluguel.dataInicio,
              dataDevolucaoReal,
              periodoCobranca,
            ),
        );

        if (duracaoCobranca <= 0) {
          throw new Error("Duração de cobrança inválida.");
        }

        const equipamentos =
          aluguel.equipamentosDetalhes || aluguel.equipamentos || [];

        const itensFechamentoMap = new Map(
          (fechamento.itensFechamento || fechamento.itens || [])
            .map(normalizarItemFechamento)
            .map((item) => [item.equipamentoId, item]),
        );

        const equipamentoRefs = equipamentos.map((item) =>
          db.collection("equipamentos").doc(item.equipamentoId || item.id),
        );

        const equipamentoDocs = [];

        for (const ref of equipamentoRefs) {
          equipamentoDocs.push(await transaction.get(ref));
        }

        let subtotalFinal = 0;
        const equipamentosFechamento = [];

        for (let i = 0; i < equipamentos.length; i++) {
          const item = equipamentos[i];
          const equipamentoDoc = equipamentoDocs[i];

          if (!equipamentoDoc.exists) {
            throw new Error(
              "Equipamento relacionado ao aluguel não encontrado.",
            );
          }

          const equipamento = equipamentoDoc.data();
          const equipamentoId = item.equipamentoId || item.id;
          const itemFechamento = itensFechamentoMap.get(equipamentoId) || {};

          const quantidadeEstoque = Number(
            item.quantidadeEstoque || item.quantidade || 0,
          );

          const quantidadeCobradaFinal = Number(
            itemFechamento.quantidadeCobradaFinal || quantidadeEstoque || 1,
          );

          if (quantidadeCobradaFinal <= 0) {
            throw new Error(
              `Quantidade cobrada inválida para "${
                item.nomeEquipamento || item.nome
              }".`,
            );
          }

          const valorUnitarioFinal = Number(
            itemFechamento.valorUnitarioFinal ||
              obterValorPorPeriodo(equipamento, periodoCobranca) ||
              0,
          );

          if (valorUnitarioFinal <= 0) {
            throw new Error(
              `Valor unitário inválido para "${
                item.nomeEquipamento || item.nome
              }".`,
            );
          }

          const subtotalItem =
            valorUnitarioFinal * quantidadeCobradaFinal * duracaoCobranca;

          subtotalFinal += subtotalItem;

          equipamentosFechamento.push({
            ...item,
            quantidadeEstoque,
            quantidadeCobradaFinal,
            unidadeCobranca:
              item.unidadeCobranca || equipamento.unidadeCobranca || "unidade",
            rotuloUnidadeCobranca:
              item.rotuloUnidadeCobranca ||
              equipamento.rotuloUnidadeCobranca ||
              "unid.",
            periodoCobranca,
            duracaoCobranca,
            valorUnitarioFinal,
            subtotalFinal: subtotalItem,
          });

          const quantidadeTotal = Number(equipamento.quantidadeTotal || 0);
          const quantidadeDisponivel = Number(
            equipamento.quantidadeDisponivel || 0,
          );
          const quantidadeAlugada = Number(equipamento.quantidadeAlugada || 0);

          transaction.update(equipamentoRefs[i], {
            quantidadeDisponivel: Math.min(
              quantidadeTotal,
              quantidadeDisponivel + quantidadeEstoque,
            ),
            quantidadeAlugada: Math.max(
              0,
              quantidadeAlugada - quantidadeEstoque,
            ),
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }

        const desconto = Number(fechamento.desconto || 0);
        const acrescimo = Number(fechamento.acrescimo || 0);
        const valorTotal = Math.max(0, subtotalFinal + acrescimo - desconto);

        const valorPago =
          fechamento.valorPago === null || fechamento.valorPago === undefined
            ? 0
            : Number(fechamento.valorPago || 0);

        const saldo = Math.max(0, valorTotal - valorPago);

        let statusPagamento = "pendente";

        if (saldo <= 0) {
          statusPagamento = "pago";
        } else if (valorPago > 0) {
          statusPagamento = "parcial";
        }

        transaction.update(aluguelRef, {
          status: "finalizado",
          dataDevolucaoReal,

          periodoCobranca,
          duracaoCobranca,
          duracaoReal: duracaoCobranca,

          equipamentosFechamento,
          equipamentosDetalhes: equipamentosFechamento,

          subtotal: subtotalFinal,
          desconto,
          acrescimo,
          valorTotal,
          valorPago,
          saldo,
          formaPagamento: fechamento.formaPagamento || "",
          statusPagamento,

          cobrancaCalculada: true,
          fechadoEm: new Date().toISOString(),
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });

      return true;
    },
  };
})();
