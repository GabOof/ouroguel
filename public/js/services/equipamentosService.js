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

  function normalizarTexto(valor) {
    return String(valor || "")
      .trim()
      .toLowerCase();
  }

  function prepararDadosEquipamento(dados) {
    return {
      nomeEquipamento: String(dados.nomeEquipamento || "").trim(),
      nomeBusca: normalizarTexto(dados.nomeEquipamento),
      categoria: dados.categoria || "",
      quantidadeTotal: Number(dados.quantidadeTotal || 0),
      valorHora: Number(dados.valorHora || 0),
      valorDia: Number(dados.valorDia || 0),
      valorMes: Number(dados.valorMes || 0),
      status: dados.status || "disponivel",
      observacoes: String(dados.observacoes || "").trim(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  window.EquipamentoService = {
    async listar() {
      const db = await aguardarFirebase();

      const snapshot = await db
        .collection("equipamentos")
        .orderBy("nomeEquipamento")
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },

    async listarTodosSemOrdenacao() {
      const db = await aguardarFirebase();

      const snapshot = await db.collection("equipamentos").get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },

    async obterPorId(equipamentoId) {
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

    async criar(dados) {
      const db = await aguardarFirebase();

      const dadosPreparados = prepararDadosEquipamento(dados);

      const docRef = await db.collection("equipamentos").add({
        ...dadosPreparados,
        quantidadeDisponivel: dadosPreparados.quantidadeTotal,
        quantidadeAlugada: 0,
        quantidadeManutencao: 0,
        ativo: true,
        dataCadastro: new Date().toISOString(),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return docRef.id;
    },

    async atualizar(equipamentoId, dados) {
      const db = await aguardarFirebase();

      const equipamentoRef = db.collection("equipamentos").doc(equipamentoId);
      const equipamentoDoc = await equipamentoRef.get();

      if (!equipamentoDoc.exists) {
        throw new Error("Equipamento não encontrado.");
      }

      const dadosAtuais = equipamentoDoc.data();

      const quantidadeAlugada = Number(dadosAtuais.quantidadeAlugada || 0);
      const quantidadeManutencao = Number(
        dadosAtuais.quantidadeManutencao || 0,
      );
      const dadosPreparados = prepararDadosEquipamento(dados);

      const quantidadeReservada = quantidadeAlugada + quantidadeManutencao;

      if (dadosPreparados.quantidadeTotal < quantidadeReservada) {
        throw new Error(
          `Não é possível definir quantidade total menor que a soma de itens alugados e em manutenção (${quantidadeReservada}).`,
        );
      }

      const quantidadeDisponivel =
        dadosPreparados.quantidadeTotal - quantidadeReservada;

      await equipamentoRef.update({
        ...dadosPreparados,
        quantidadeAlugada,
        quantidadeManutencao,
        quantidadeDisponivel,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return equipamentoId;
    },

    async existeAluguelAtivo(equipamentoId) {
      const db = await aguardarFirebase();

      const snapshot = await db
        .collection("alugueis")
        .where("equipamentosIds", "array-contains", equipamentoId)
        .where("status", "==", "ativo")
        .limit(1)
        .get();

      return !snapshot.empty;
    },

    async excluir(equipamentoId) {
      const db = await aguardarFirebase();

      const possuiAluguelAtivo = await this.existeAluguelAtivo(equipamentoId);

      if (possuiAluguelAtivo) {
        throw new Error(
          "Não é possível excluir este equipamento, pois existem aluguéis ativos relacionados a ele.",
        );
      }

      await db.collection("equipamentos").doc(equipamentoId).delete();

      return true;
    },

    async obterEstatisticas() {
      const equipamentos = await this.listarTodosSemOrdenacao();

      let totalEquipamentos = 0;
      let totalDisponivel = 0;
      let totalIndisponivel = 0;
      let totalManutencao = 0;

      equipamentos.forEach((equipamento) => {
        const quantidadeTotal = Number(equipamento.quantidadeTotal || 0);
        const quantidadeDisponivel = Number(
          equipamento.quantidadeDisponivel || 0,
        );
        const quantidadeManutencao = Number(
          equipamento.quantidadeManutencao || 0,
        );

        totalEquipamentos += quantidadeTotal;

        if (equipamento.status === "disponivel") {
          totalDisponivel += quantidadeDisponivel;
        }

        if (equipamento.status === "indisponivel") {
          totalIndisponivel += quantidadeTotal;
        }

        if (equipamento.status === "manutencao") {
          totalManutencao += quantidadeTotal;
        } else {
          totalManutencao += quantidadeManutencao;
        }
      });

      return {
        totalEquipamentos,
        totalDisponivel,
        totalIndisponivel,
        totalManutencao,
      };
    },
  };
})();
