(function () {
  async function aguardarFirebase() {
    if (window.firebaseReady) {
      await window.firebaseReady;
    }

    if (!window.db || !window.auth || !window.firebase) {
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

  function criarDataLocal(dataISO) {
    const [ano, mes, dia] = String(dataISO || "")
      .split("-")
      .map(Number);

    if (!ano || !mes || !dia) {
      return new Date();
    }

    return new Date(ano, mes - 1, dia);
  }

  function calcularDataDevolucaoPrevista(dataInicio, periodo, duracao) {
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

  function calcularDuracaoReal(dataInicio, dataFim, periodo) {
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

  function possuiAlgumPreco(equipamento) {
    return (
      Number(equipamento.valorHora || 0) > 0 ||
      Number(equipamento.valorDia || 0) > 0 ||
      Number(equipamento.valorMes || 0) > 0
    );
  }

  function obterRotuloUnidadeCobranca(item) {
    if (item.rotuloUnidadeCobranca) {
      return item.rotuloUnidadeCobranca;
    }

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

  function validarDadosRegistro(dados) {
    if (!dados.clienteId) {
      throw new Error("Cliente não informado.");
    }

    if (!dados.cliente) {
      throw new Error("Dados do cliente não informados.");
    }

    if (!dados.dataInicio) {
      throw new Error("Data de início não informada.");
    }

    if (!["hora", "dia", "mes"].includes(dados.periodo)) {
      throw new Error("Período inválido.");
    }

    if (!Number(dados.duracaoPrevista || dados.duracao || 0)) {
      throw new Error("Duração prevista inválida.");
    }

    if (!Array.isArray(dados.equipamentos) || dados.equipamentos.length === 0) {
      throw new Error("Nenhum equipamento informado.");
    }
  }

  function validarFechamento(fechamento) {
    if (!fechamento || typeof fechamento !== "object") {
      throw new Error("Dados de fechamento não informados.");
    }

    if (!fechamento.dataDevolucaoReal) {
      throw new Error("Data real de devolução não informada.");
    }
  }

  window.AluguelService = {
    async listarClientes() {
      const db = await aguardarFirebase();

      const snapshot = await db.collection("clientes").orderBy("nome").get();

      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((cliente) => cliente.ativo !== false);
    },

    async obterClientePorId(clienteId) {
      const db = await aguardarFirebase();

      const doc = await db.collection("clientes").doc(clienteId).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
      };
    },

    async listarEquipamentosDisponiveis() {
      const db = await aguardarFirebase();

      const snapshot = await db
        .collection("equipamentos")
        .orderBy("nomeEquipamento")
        .get();

      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((equipamento) => {
          const ativo = equipamento.ativo !== false;
          const disponivel = equipamento.status === "disponivel";
          const quantidadeDisponivel = Number(
            equipamento.quantidadeDisponivel || 0,
          );

          return (
            ativo &&
            disponivel &&
            quantidadeDisponivel > 0 &&
            possuiAlgumPreco(equipamento)
          );
        });
    },

    async obterEquipamentoPorId(equipamentoId) {
      const db = await aguardarFirebase();

      const doc = await db.collection("equipamentos").doc(equipamentoId).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
      };
    },

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
      validarDadosRegistro(dados);

      const db = await aguardarFirebase();
      const aluguelRef = db.collection("alugueis").doc();

      const duracaoPrevista = Number(
        dados.duracaoPrevista || dados.duracao || 1,
      );
      const dataDevolucaoPrevista = calcularDataDevolucaoPrevista(
        dados.dataInicio,
        dados.periodo,
        duracaoPrevista,
      );

      await db.runTransaction(async function (transaction) {
        const equipamentoRefs = dados.equipamentos.map((item) =>
          db.collection("equipamentos").doc(item.equipamentoId || item.id),
        );

        const equipamentoDocs = [];

        for (const ref of equipamentoRefs) {
          equipamentoDocs.push(await transaction.get(ref));
        }

        const equipamentosDetalhes = [];
        let subtotalPrevisto = 0;

        for (let i = 0; i < dados.equipamentos.length; i++) {
          const itemSelecionado = dados.equipamentos[i];
          const equipamentoDoc = equipamentoDocs[i];

          if (!equipamentoDoc.exists) {
            throw new Error(
              `Equipamento ${itemSelecionado.nomeEquipamento || itemSelecionado.nome || ""} não encontrado.`,
            );
          }

          const equipamentoAtual = equipamentoDoc.data();

          if (equipamentoAtual.ativo === false) {
            throw new Error(
              `Equipamento "${equipamentoAtual.nomeEquipamento}" está inativo.`,
            );
          }

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
          const quantidadeEstoque = Number(
            itemSelecionado.quantidadeEstoque ||
              itemSelecionado.quantidade ||
              0,
          );

          if (quantidadeEstoque <= 0) {
            throw new Error(
              `Quantidade de estoque inválida para "${equipamentoAtual.nomeEquipamento}".`,
            );
          }

          if (quantidadeEstoque > quantidadeDisponivel) {
            throw new Error(
              `Estoque insuficiente para "${equipamentoAtual.nomeEquipamento}". Disponível: ${quantidadeDisponivel}.`,
            );
          }

          const valorUnitario = obterValorPorPeriodo(
            equipamentoAtual,
            dados.periodo,
          );

          if (valorUnitario <= 0) {
            throw new Error(
              `Valor do período não configurado para "${equipamentoAtual.nomeEquipamento}".`,
            );
          }

          const quantidadeCobradaPrevista = Number(
            itemSelecionado.quantidadeCobradaPrevista ||
              itemSelecionado.quantidadeCobrada ||
              itemSelecionado.quantidade ||
              1,
          );

          if (quantidadeCobradaPrevista <= 0) {
            throw new Error(
              `Quantidade cobrada inválida para "${equipamentoAtual.nomeEquipamento}".`,
            );
          }

          const subtotalItemPrevisto =
            valorUnitario * quantidadeCobradaPrevista * duracaoPrevista;

          subtotalPrevisto += subtotalItemPrevisto;

          const unidadeCobranca =
            itemSelecionado.unidadeCobranca ||
            equipamentoAtual.unidadeCobranca ||
            "unidade";

          const rotuloUnidadeCobranca =
            itemSelecionado.rotuloUnidadeCobranca ||
            equipamentoAtual.rotuloUnidadeCobranca ||
            obterRotuloUnidadeCobranca({ unidadeCobranca });

          equipamentosDetalhes.push({
            equipamentoId: itemSelecionado.equipamentoId || itemSelecionado.id,

            nome: equipamentoAtual.nomeEquipamento || itemSelecionado.nome,
            nomeEquipamento:
              equipamentoAtual.nomeEquipamento ||
              itemSelecionado.nomeEquipamento ||
              itemSelecionado.nome,

            quantidade: quantidadeEstoque,
            quantidadeEstoque,

            quantidadeCobrada: quantidadeCobradaPrevista,
            quantidadeCobradaPrevista,

            unidadeCobranca,
            rotuloUnidadeCobranca,
            permiteQuantidadeDecimal: Boolean(
              itemSelecionado.permiteQuantidadeDecimal ||
              equipamentoAtual.permiteQuantidadeDecimal,
            ),

            valorUnitarioPrevisto: valorUnitario,
            valorUnitario,
            valorHora: Number(equipamentoAtual.valorHora || 0),
            valorDia: Number(equipamentoAtual.valorDia || 0),
            valorMes: Number(equipamentoAtual.valorMes || 0),

            subtotalPrevisto: subtotalItemPrevisto,
          });

          transaction.update(equipamentoRefs[i], {
            quantidadeDisponivel: quantidadeDisponivel - quantidadeEstoque,
            quantidadeAlugada: quantidadeAlugada + quantidadeEstoque,
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
          dataDevolucaoPrevista,
          periodo: dados.periodo,
          duracaoPrevista,
          duracao: duracaoPrevista,

          equipamentosIds: equipamentosDetalhes.map(
            (item) => item.equipamentoId,
          ),
          equipamentos: equipamentosDetalhes,
          equipamentosDetalhes,

          subtotalPrevisto,
          valorPrevisto: subtotalPrevisto,
          valorTotal: null,
          subtotal: null,
          desconto: 0,
          acrescimo: 0,
          valorPago: 0,
          saldo: null,
          statusPagamento: "pendente",
          formaPagamento: "",

          observacoes: dados.observacoes || "",
          observacoesFechamento: "",

          status: "ativo",
          cobrancaCalculada: false,
          dataRegistro: new Date().toISOString(),
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          criadoPor: window.auth?.currentUser?.uid || null,
        });
      });

      return aluguelRef.id;
    },

    async finalizar(aluguelId, fechamento = {}) {
      validarFechamento(fechamento);

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

        const dataDevolucaoReal = fechamento.dataDevolucaoReal || dataHojeISO();
        const duracaoReal = calcularDuracaoReal(
          aluguel.dataInicio,
          dataDevolucaoReal,
          aluguel.periodo,
        );

        const equipamentos =
          aluguel.equipamentosDetalhes || aluguel.equipamentos || [];

        const itensFechamentoMap = new Map(
          (fechamento.itensFechamento || fechamento.itens || []).map((item) => [
            item.equipamentoId || item.id,
            item,
          ]),
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
            itemFechamento.quantidadeCobradaFinal ||
              itemFechamento.quantidadeCobrada ||
              item.quantidadeCobradaFinal ||
              item.quantidadeCobrada ||
              item.quantidadeCobradaPrevista ||
              item.quantidade ||
              1,
          );

          if (quantidadeCobradaFinal <= 0) {
            throw new Error(
              `Quantidade cobrada inválida para "${item.nomeEquipamento || item.nome}".`,
            );
          }

          const valorUnitarioFinal = Number(
            itemFechamento.valorUnitarioFinal ||
              itemFechamento.valorUnitario ||
              item.valorUnitarioFinal ||
              item.valorUnitario ||
              obterValorPorPeriodo(equipamento, aluguel.periodo) ||
              0,
          );

          if (valorUnitarioFinal <= 0) {
            throw new Error(
              `Valor unitário inválido para "${item.nomeEquipamento || item.nome}".`,
            );
          }

          const subtotalItemFinal =
            valorUnitarioFinal * quantidadeCobradaFinal * duracaoReal;

          subtotalFinal += subtotalItemFinal;

          equipamentosFechamento.push({
            ...item,
            quantidadeEstoque,
            quantidadeCobradaFinal,
            valorUnitarioFinal,
            duracaoReal,
            subtotalFinal: subtotalItemFinal,
            unidadeCobranca:
              item.unidadeCobranca || equipamento.unidadeCobranca || "unidade",
            rotuloUnidadeCobranca:
              item.rotuloUnidadeCobranca ||
              equipamento.rotuloUnidadeCobranca ||
              obterRotuloUnidadeCobranca(equipamento),
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
            ? valorTotal
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
          duracaoReal,

          equipamentosFechamento,
          equipamentosDetalhes: equipamentosFechamento,
          equipamentos: equipamentosFechamento,

          subtotal: subtotalFinal,
          desconto,
          acrescimo,
          valorTotal,
          valorPago,
          saldo,
          formaPagamento: fechamento.formaPagamento || "",
          statusPagamento,
          observacoesFechamento: fechamento.observacoesFechamento || "",

          cobrancaCalculada: true,
          fechadoEm: new Date().toISOString(),
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });

      return true;
    },
  };
})();
