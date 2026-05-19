// Variáveis globais
let clientes = [];
let clienteEditando = null;

function alternarTipoCliente(tipo) {
  const tipoCliente = tipo === "juridica" ? "juridica" : "fisica";

  const inputTipoCliente = document.getElementById("tipoCliente");
  const camposPessoaFisica = document.getElementById("camposPessoaFisica");
  const camposPessoaJuridica = document.getElementById("camposPessoaJuridica");

  if (inputTipoCliente) {
    inputTipoCliente.value = tipoCliente;
  }

  if (camposPessoaFisica) {
    camposPessoaFisica.style.display =
      tipoCliente === "fisica" ? "block" : "none";
  }

  if (camposPessoaJuridica) {
    camposPessoaJuridica.style.display =
      tipoCliente === "juridica" ? "block" : "none";
  }

  document.querySelectorAll(".tipo-cliente-btn").forEach((botao) => {
    botao.classList.remove("active");

    if (botao.dataset.tipoCliente === tipoCliente) {
      botao.classList.add("active");
    }
  });

  if (tipoCliente === "fisica") {
    document.getElementById("nome")?.focus();
  } else {
    document.getElementById("razaoSocial")?.focus();
  }
}

window.alternarTipoCliente = alternarTipoCliente;

document.addEventListener("DOMContentLoaded", async function () {
  try {
    if (window.firebaseReady) {
      await window.firebaseReady;
    }

    configurarFormularioCliente();
    await carregarClientes();
  } catch (error) {
    console.error("Erro ao inicializar tela de clientes:", error);
    alert("Erro ao carregar Firebase. Verifique o console.");
  }
});

function configurarFormularioCliente() {
  const form = document.getElementById("clienteForm");

  if (form) {
    form.addEventListener("submit", salvarCliente);
  }

  const dataNascimento = document.getElementById("dataNascimento");

  if (dataNascimento) {
    dataNascimento.max = new Date().toISOString().split("T")[0];
  }

  const dataAbertura = document.getElementById("dataAbertura");

  if (dataAbertura) {
    dataAbertura.max = new Date().toISOString().split("T")[0];
  }

  const cpfInput = document.getElementById("cpf");

  if (cpfInput) {
    cpfInput.addEventListener("input", aplicarMascaraCpfCnpj);
  }

  const cnpjInput = document.getElementById("cnpj");

  if (cnpjInput) {
    cnpjInput.addEventListener("input", aplicarMascaraCpfCnpj);
  }

  const cpfProprietarioInput = document.getElementById("cpfProprietario");

  if (cpfProprietarioInput) {
    cpfProprietarioInput.addEventListener("input", aplicarMascaraCpfCnpj);
  }

  const cepInput = document.getElementById("cep");

  if (cepInput) {
    cepInput.addEventListener("blur", buscarCEP);
  }

  alternarTipoCliente("fisica");
}

function aplicarMascaraCpfCnpj(event) {
  let valor = event.target.value.replace(/\D/g, "");

  if (valor.length <= 11) {
    valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
    valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
    valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    valor = valor.replace(/^(\d{2})(\d)/, "$1.$2");
    valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    valor = valor.replace(/\.(\d{3})(\d)/, ".$1/$2");
    valor = valor.replace(/(\d{4})(\d)/, "$1-$2");
  }

  event.target.value = valor.substring(0, 18);
}

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function obterDocumentoCliente(dadosCliente) {
  if (dadosCliente.tipoCliente === "juridica") {
    return dadosCliente.cnpjLimpo || somenteNumeros(dadosCliente.cnpj);
  }

  return dadosCliente.cpfLimpo || somenteNumeros(dadosCliente.cpf);
}

function valorCampo(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value.trim() : "";
}

function preencherCampo(id, valor) {
  const campo = document.getElementById(id);

  if (campo) {
    campo.value = valor || "";
  }
}

function preencherCheckbox(id, valor) {
  const campo = document.getElementById(id);

  if (campo) {
    campo.checked = Boolean(valor);
  }
}

function escaparHTML(valor) {
  const div = document.createElement("div");
  div.textContent = valor || "";
  return div.innerHTML;
}

function coletarDadosCliente() {
  const tipoCliente = valorCampo("tipoCliente") || "fisica";
  const cpf = valorCampo("cpf");
  const cnpj = valorCampo("cnpj");
  const clienteSpc = document.getElementById("clienteSpc");

  return {
    tipoCliente,

    nome: valorCampo("nome"),
    dataNascimento: valorCampo("dataNascimento"),
    cpf,
    cpfLimpo: somenteNumeros(cpf),
    identidade: valorCampo("identidade"),

    razaoSocial: valorCampo("razaoSocial"),
    nomeFantasia: valorCampo("nomeFantasia"),
    cnpj,
    cnpjLimpo: somenteNumeros(cnpj),
    dataAbertura: valorCampo("dataAbertura"),
    inscricaoEstadual: valorCampo("inscricaoEstadual"),
    inscricaoMunicipal: valorCampo("inscricaoMunicipal"),
    proprietario: valorCampo("proprietario"),
    cpfProprietario: valorCampo("cpfProprietario"),

    telefone: valorCampo("telefone"),
    celular: valorCampo("celular"),
    email: valorCampo("email"),

    cep: valorCampo("cep"),
    endereco: valorCampo("endereco"),
    bairro: valorCampo("bairro"),
    cidade: valorCampo("cidade"),
    estado: valorCampo("estado"),

    naturalidade: valorCampo("naturalidade"),
    nomePai: valorCampo("nomePai"),
    nomeMae: valorCampo("nomeMae"),

    estaNoSpc: clienteSpc ? clienteSpc.checked : false,
    observacaoRestricao: valorCampo("observacaoRestricao"),
  };
}

function validarCliente(dadosCliente) {
  if (dadosCliente.tipoCliente === "juridica") {
    if (!dadosCliente.razaoSocial) {
      return "Razão Social é obrigatória.";
    }

    if (!dadosCliente.cnpj) {
      return "CNPJ é obrigatório.";
    }

    if (dadosCliente.cnpjLimpo.length !== 14) {
      return "CNPJ deve ter 14 dígitos.";
    }
  } else {
    if (!dadosCliente.nome) {
      return "Nome é obrigatório.";
    }

    if (!dadosCliente.cpf) {
      return "CPF é obrigatório.";
    }

    if (dadosCliente.cpfLimpo.length !== 11) {
      return "CPF deve ter 11 dígitos.";
    }
  }

  if (!dadosCliente.celular && !dadosCliente.telefone) {
    return "Informe pelo menos um telefone ou celular.";
  }

  if (
    dadosCliente.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dadosCliente.email)
  ) {
    return "E-mail inválido.";
  }

  return null;
}

async function salvarCliente(event) {
  event.preventDefault();

  const dadosCliente = coletarDadosCliente();

  const erroValidacao = validarCliente(dadosCliente);

  if (erroValidacao) {
    mostrarMensagem("Erro", erroValidacao, "error");
    return;
  }

  try {
    const documentoLimpo = obterDocumentoCliente(dadosCliente);

    const documentoDuplicado = await clientesService.documentoJaExiste(
      documentoLimpo,
      clienteEditando,
    );

    if (documentoDuplicado) {
      mostrarMensagem(
        "Erro",
        "Já existe um cliente cadastrado com este CPF/CNPJ.",
        "error",
      );

      if (dadosCliente.tipoCliente === "juridica") {
        document.getElementById("cnpj")?.focus();
      } else {
        document.getElementById("cpf")?.focus();
      }

      return;
    }

    if (clienteEditando) {
      await clientesService.atualizar(clienteEditando, dadosCliente);
      mostrarMensagem("Sucesso", "Cliente atualizado com sucesso!");
    } else {
      await clientesService.criar(dadosCliente);
      mostrarMensagem("Sucesso", "Cliente cadastrado com sucesso!");
    }

    limparFormulario();
    await carregarClientes();
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);

    mostrarMensagem(
      "Erro",
      "Erro ao salvar cliente: " + error.message,
      "error",
    );
  }
}

async function carregarClientes() {
  const clientesList = document.getElementById("clientesList");

  if (!clientesList) {
    return;
  }

  try {
    clientesList.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
          <p>Carregando clientes...</p>
        </td>
      </tr>
    `;

    clientes = await clientesService.listar();

    if (!clientes.length) {
      clientesList.innerHTML = `
        <tr>
          <td colspan="5" class="empty-message">
            <i class="fas fa-users"></i>
            <p>Nenhum cliente cadastrado ainda</p>
          </td>
        </tr>
      `;
      return;
    }

    clientesList.innerHTML = clientes
      .map((cliente) => {
        const tipoCliente = cliente.tipoCliente || "fisica";
        const nomeExibicao = escaparHTML(
          cliente.nomeExibicao ||
            cliente.nomeFantasia ||
            cliente.razaoSocial ||
            cliente.nome,
        );
        const email = escaparHTML(cliente.email);
        const documento = escaparHTML(
          tipoCliente === "juridica" ? cliente.cnpj : cliente.cpf,
        );
        const celular = escaparHTML(cliente.celular);
        const cidade = escaparHTML(cliente.cidade);
        const estado = escaparHTML(cliente.estado);
        const tipoTexto = tipoCliente === "juridica" ? "PJ" : "PF";
        const observacaoRestricao = escaparHTML(cliente.observacaoRestricao);

        return `
          <tr class="${cliente.estaNoSpc ? "cliente-spc-row" : ""}">
            <td>
              <span class="badge-tipo-cliente">${tipoTexto}</span>

              <strong class="${cliente.estaNoSpc ? "cliente-nome-spc" : ""}">
                ${nomeExibicao}
              </strong>

              ${
                cliente.estaNoSpc
                  ? `<span class="badge-spc">
                      <i class="fas fa-ban"></i> Restrição
                    </span>`
                  : ""
              }

              ${
                tipoCliente === "juridica" && cliente.razaoSocial
                  ? `<br><small>Razão Social: ${escaparHTML(cliente.razaoSocial)}</small>`
                  : ""
              }

              ${email ? `<br><small>${email}</small>` : ""}

              ${
                observacaoRestricao
                  ? `<br><small class="texto-restricao">${observacaoRestricao}</small>`
                  : ""
              }
            </td>

            <td>${documento}</td>
            <td>${celular || escaparHTML(cliente.telefone)}</td>
            <td>${cidade}${estado ? "/" + estado : ""}</td>

            <td>
              <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button class="btn btn-small btn-primary" onclick="editarCliente('${cliente.id}')">
                  <i class="fas fa-edit"></i>
                </button>

                <button class="btn btn-small btn-success" onclick="selecionarClienteParaAluguel('${cliente.id}')">
                  <i class="fas fa-handshake"></i>
                </button>

                <button class="btn btn-small btn-danger" onclick="excluirCliente('${cliente.id}')">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);

    clientesList.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: #e74c3c;">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar clientes</p>
          <small>${escaparHTML(error.message)}</small>
        </td>
      </tr>
    `;
  }
}

function buscarClientes() {
  const termo = document.getElementById("searchClientes").value.toLowerCase();
  const linhas = document.querySelectorAll("#clientesList tr");

  linhas.forEach((linha) => {
    const textoLinha = linha.textContent.toLowerCase();
    if (textoLinha.includes(termo)) {
      linha.style.display = "";
    } else {
      linha.style.display = "none";
    }
  });
}

async function editarCliente(clienteId) {
  try {
    const cliente = await clientesService.obterPorId(clienteId);

    if (!cliente) {
      mostrarMensagem("Erro", "Cliente não encontrado.", "error");
      return;
    }

    clienteEditando = clienteId;

    const tipoCliente = cliente.tipoCliente || "fisica";

    alternarTipoCliente(tipoCliente);

    preencherCampo("tipoCliente", tipoCliente);

    preencherCampo("nome", cliente.nome);
    preencherCampo("dataNascimento", cliente.dataNascimento);
    preencherCampo("cpf", cliente.cpf);
    preencherCampo("identidade", cliente.identidade);

    preencherCampo("razaoSocial", cliente.razaoSocial);
    preencherCampo("nomeFantasia", cliente.nomeFantasia);
    preencherCampo("cnpj", cliente.cnpj);
    preencherCampo("dataAbertura", cliente.dataAbertura);
    preencherCampo("inscricaoEstadual", cliente.inscricaoEstadual);
    preencherCampo("inscricaoMunicipal", cliente.inscricaoMunicipal);
    preencherCampo("proprietario", cliente.proprietario);
    preencherCampo("cpfProprietario", cliente.cpfProprietario);

    preencherCampo("telefone", cliente.telefone);
    preencherCampo("celular", cliente.celular);
    preencherCampo("email", cliente.email);

    preencherCampo("cep", cliente.cep);
    preencherCampo("endereco", cliente.endereco);
    preencherCampo("bairro", cliente.bairro);
    preencherCampo("cidade", cliente.cidade);
    preencherCampo("estado", cliente.estado);

    preencherCampo("naturalidade", cliente.naturalidade);
    preencherCampo("nomePai", cliente.nomePai);
    preencherCampo("nomeMae", cliente.nomeMae);

    preencherCheckbox("clienteSpc", cliente.estaNoSpc);
    preencherCampo("observacaoRestricao", cliente.observacaoRestricao);

    const botaoSalvar = document.querySelector(
      '#clienteForm button[type="submit"]',
    );

    if (botaoSalvar) {
      botaoSalvar.innerHTML =
        '<i class="fas fa-sync-alt"></i> Atualizar Cliente';
    }

    const formSection = document.querySelector(".form-section");

    if (formSection) {
      formSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    mostrarMensagem(
      "Informação",
      "Editando cliente. Modifique os dados e clique em Atualizar.",
    );
  } catch (error) {
    console.error("Erro ao carregar cliente para edição:", error);

    mostrarMensagem(
      "Erro",
      "Não foi possível carregar o cliente para edição.",
      "error",
    );
  }
}

async function excluirCliente(clienteId) {
  const confirmar = confirm("Tem certeza que deseja excluir este cliente?");

  if (!confirmar) {
    return;
  }

  try {
    await clientesService.excluir(clienteId);

    mostrarMensagem("Sucesso", "Cliente excluído com sucesso!");

    await carregarClientes();
  } catch (error) {
    console.error("Erro ao excluir cliente:", error);

    mostrarMensagem(
      "Erro",
      "Erro ao excluir cliente: " + error.message,
      "error",
    );
  }
}

function selecionarClienteParaAluguel(clienteId) {
  localStorage.setItem("clienteSelecionado", clienteId);
  window.location.href = "aluguel.html";
}

function limparFormulario() {
  document.getElementById("clienteForm").reset();
  clienteEditando = null;

  const botaoSalvar = document.querySelector(
    '#clienteForm button[type="submit"]',
  );
  if (botaoSalvar) {
    botaoSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Cliente';
  }

  document.getElementById("nome").focus();
}

async function buscarCEP() {
  const cep = document.getElementById("cep").value.replace(/\D/g, "");

  if (cep.length !== 8) {
    return;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (!data.erro) {
      document.getElementById("endereco").value = data.logradouro || "";
      document.getElementById("bairro").value = data.bairro || "";
      document.getElementById("cidade").value = data.localidade || "";
      document.getElementById("estado").value = data.uf || "";

      const naturalidade = document.getElementById("naturalidade");
      if (naturalidade && !naturalidade.value) {
        naturalidade.value = `${data.localidade}/${data.uf}`;
      }

      const endereco = document.getElementById("endereco");
      if (endereco) {
        endereco.focus();
      }

      const campoNumero = document.getElementById("numero");

      if (campoNumero) {
        campoNumero.focus();
      }
    }
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const cepInput = document.getElementById("cep");
  if (cepInput) {
    cepInput.addEventListener("blur", buscarCEP);
  }
});
