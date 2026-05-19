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
    const tipoCliente =
      dados.tipoCliente === "juridica" ? "juridica" : "fisica";

    const cpfLimpo = somenteNumeros(dados.cpf);
    const cnpjLimpo = somenteNumeros(dados.cnpj);
    const documentoLimpo = tipoCliente === "juridica" ? cnpjLimpo : cpfLimpo;

    const nomePrincipal =
      tipoCliente === "juridica"
        ? String(dados.razaoSocial || "").trim()
        : String(dados.nome || "").trim();

    const nomeSecundario =
      tipoCliente === "juridica" ? String(dados.nomeFantasia || "").trim() : "";

    return {
      tipoCliente,

      nome: tipoCliente === "fisica" ? nomePrincipal : "",
      razaoSocial: tipoCliente === "juridica" ? nomePrincipal : "",
      nomeFantasia: nomeSecundario,

      nomeExibicao: nomeSecundario || nomePrincipal,
      nomeBusca: normalizarTexto(`${nomePrincipal} ${nomeSecundario}`),

      dataNascimento: dados.dataNascimento || "",
      dataAbertura: dados.dataAbertura || "",

      cpf: tipoCliente === "fisica" ? dados.cpf || "" : "",
      cnpj: tipoCliente === "juridica" ? dados.cnpj || "" : "",

      cpfLimpo,
      cnpjLimpo,
      documentoLimpo,

      identidade: dados.identidade || "",

      inscricaoEstadual: dados.inscricaoEstadual || "",
      inscricaoMunicipal: dados.inscricaoMunicipal || "",
      proprietario: dados.proprietario || "",
      cpfProprietario: dados.cpfProprietario || "",

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
      observacaoRestricao: dados.observacaoRestricao || "",

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

    async documentoJaExiste(documentoLimpo, ignorarClienteId = null) {
      const db = await getDb();

      if (!documentoLimpo) {
        return false;
      }

      const consultas = [
        db
          .collection("clientes")
          .where("documentoLimpo", "==", documentoLimpo)
          .limit(1)
          .get(),
        db
          .collection("clientes")
          .where("cpfLimpo", "==", documentoLimpo)
          .limit(1)
          .get(),
        db
          .collection("clientes")
          .where("cnpjLimpo", "==", documentoLimpo)
          .limit(1)
          .get(),
      ];

      const snapshots = await Promise.all(consultas);

      return snapshots.some((snapshot) => {
        if (snapshot.empty) {
          return false;
        }

        return snapshot.docs.some((doc) => doc.id !== ignorarClienteId);
      });
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

  function alternarTipoCliente(tipo) {
    const tipoCliente = tipo === "juridica" ? "juridica" : "fisica";

    preencherCampo("tipoCliente", tipoCliente);

    const camposPF = document.getElementById("camposPessoaFisica");
    const camposPJ = document.getElementById("camposPessoaJuridica");

    if (camposPF) {
      camposPF.style.display = tipoCliente === "fisica" ? "" : "none";
    }

    if (camposPJ) {
      camposPJ.style.display = tipoCliente === "juridica" ? "" : "none";
    }

    document.querySelectorAll(".tipo-cliente-btn").forEach((botao) => {
      botao.classList.toggle(
        "active",
        botao.dataset.tipoCliente === tipoCliente,
      );
    });

    if (tipoCliente === "fisica") {
      document.getElementById("nome")?.focus();
    } else {
      document.getElementById("razaoSocial")?.focus();
    }
  }

  function preencherCheckbox(id, valor) {
    const campo = document.getElementById(id);

    if (campo) {
      campo.checked = Boolean(valor);
    }
  }

  function obterDocumentoCliente(dadosCliente) {
    return dadosCliente.tipoCliente === "juridica"
      ? dadosCliente.cnpjLimpo
      : dadosCliente.cpfLimpo;
  }
})();
