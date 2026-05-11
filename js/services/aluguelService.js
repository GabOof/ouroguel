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

    if (!dados.duracao || dados.duracao <= 0) {
      throw new Error("Duração inválida.");
    }

    if (!Array.isArray(dados.equipamentos) || dados.equipamentos.length === 0) {
      throw new Error("Nenhum equipamento informado.");
    }
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
      validarDadosRegistro(dados);

      const db = await aguardarFirebase();

      const aluguelRef = db.collection("alugueis").doc();
      const dataDevolucao = calcularDataDevolucao(
        dados.dataInicio,
        dados.periodo,
        dados.duracao,
      );

      await db.runTransaction(async function (transaction) {
        const equipamentoRefs = dados.equipamentos.map((item) =>
          db.collection("equipamentos").doc(item.id || item.equipamentoId),
        );

        const equipamentoDocs = [];

        for (const ref of equipamentoRefs) {
          equipamentoDocs.push(await transaction.get(ref));
        }

        const equipamentosDetalhes = [];
        let subtotal = 0;

        for (let i = 0; i < dados.equipamentos.length; i++) {
          const itemSelecionado = dados.equipamentos[i];
          const equipamentoDoc = equipamentoDocs[i];

          if (!equipamentoDoc.exists) {
            throw new Error(
              `Equipamento ${itemSelecionado.nomeEquipamento || itemSelecionado.nome || ""} não encontrado.`,
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

          const valorUnitario = obterValorPorPeriodo(
            equipamentoAtual,
            dados.periodo,
          );

          if (valorUnitario <= 0) {
            throw new Error(
              `Valor do período não configurado para "${equipamentoAtual.nomeEquipamento}".`,
            );
          }

          subtotal += valorUnitario * quantidadeSolicitada;

          equipamentosDetalhes.push({
            equipamentoId: itemSelecionado.id || itemSelecionado.equipamentoId,
            nome: equipamentoAtual.nomeEquipamento || itemSelecionado.nome,
            nomeEquipamento:
              equipamentoAtual.nomeEquipamento ||
              itemSelecionado.nomeEquipamento ||
              itemSelecionado.nome,
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

        const valorTotal = subtotal * dados.duracao;

        transaction.set(aluguelRef, {
          clienteId: dados.clienteId,
          clienteNome: dados.cliente.nome || "",
          clienteCpf: dados.cliente.cpf || "",
          clienteCelular: dados.cliente.celular || "",

          dataInicio: dados.dataInicio,
          dataDevolucao,
          periodo: dados.periodo,
          duracao: dados.duracao,

          equipamentosIds: equipamentosDetalhes.map(
            (item) => item.equipamentoId,
          ),
          equipamentos: equipamentosDetalhes,
          equipamentosDetalhes,

          subtotal,
          valorTotal,
          observacoes: dados.observacoes || "",

          status: "ativo",
          dataRegistro: new Date().toISOString(),
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          criadoPor: window.auth?.currentUser?.uid || null,
        });
      });

      return aluguelRef.id;
    },

    async finalizar(aluguelId) {
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
            throw new Error(
              "Equipamento relacionado ao aluguel não encontrado.",
            );
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

      return true;
    },
  };
})();
