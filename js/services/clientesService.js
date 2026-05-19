(function () {
  async function getDb() {
    if (window.firebaseReady) {
      await window.firebaseReady;
    }

    if (!window.db) {
      throw new Error(
        "Firestore não inicializado. Verifique firebase-config.js.",
      );
    }

    return window.db;
  }

  function somenteNumeros(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function normalizarTexto(valor) {
    return String(valor || "")
      .trim()
      .toLowerCase();
  }

  function prepararDadosCliente(dados) {
    const cpfLimpo = somenteNumeros(dados.cpf);

    return {
      nome: String(dados.nome || "").trim(),
      nomeBusca: normalizarTexto(dados.nome),

      dataNascimento: dados.dataNascimento || "",
      cpf: dados.cpf || "",
      cpfLimpo,

      identidade: dados.identidade || "",
      telefone: dados.telefone || "",
      celular: dados.celular || "",
      email: normalizarTexto(dados.email),

      cep: dados.cep || "",
      endereco: dados.endereco || "",
      bairro: dados.bairro || "",
      cidade: dados.cidade || "",
      estado: dados.estado || "",

      naturalidade: dados.naturalidade || "",
      nomePai: dados.nomePai || "",
      nomeMae: dados.nomeMae || "",

      estaNoSpc: Boolean(dados.estaNoSpc),

      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  window.clientesService = {
    async listar() {
      const db = await getDb();

      const snapshot = await db.collection("clientes").orderBy("nome").get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },

    async obterPorId(clienteId) {
      const db = await getDb();

      const doc = await db.collection("clientes").doc(clienteId).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
      };
    },

    async cpfJaExiste(cpfLimpo, ignorarClienteId = null) {
      const db = await getDb();

      if (!cpfLimpo) {
        return false;
      }

      const snapshot = await db
        .collection("clientes")
        .where("cpfLimpo", "==", cpfLimpo)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return false;
      }

      return snapshot.docs.some((doc) => doc.id !== ignorarClienteId);
    },

    async criar(dados) {
      const db = await getDb();

      const dadosPreparados = prepararDadosCliente(dados);

      const docRef = await db.collection("clientes").add({
        ...dadosPreparados,
        ativo: true,
        dataCadastro: new Date().toISOString(),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return docRef.id;
    },

    async atualizar(clienteId, dados) {
      const db = await getDb();

      const dadosPreparados = prepararDadosCliente(dados);

      await db.collection("clientes").doc(clienteId).update(dadosPreparados);

      return clienteId;
    },

    async excluir(clienteId) {
      const db = await getDb();

      await db.collection("clientes").doc(clienteId).delete();

      return true;
    },
  };
})();
