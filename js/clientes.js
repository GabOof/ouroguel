// Variáveis globais
let clientes = [];
let clienteEditando = null;

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

  const cpfInput = document.getElementById("cpf");

  if (cpfInput) {
    cpfInput.addEventListener("input", aplicarMascaraCpfCnpj);
  }

  const cepInput = document.getElementById("cep");

  if (cepInput) {
    cepInput.addEventListener("blur", buscarCEP);
  }
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
  const cpf = valorCampo("cpf");
  const clienteSpc = document.getElementById("clienteSpc");

  return {
    nome: valorCampo("nome"),
    dataNascimento: valorCampo("dataNascimento"),
    cpf,
    cpfLimpo: somenteNumeros(cpf),
    identidade: valorCampo("identidade"),
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
  };
}

function validarCliente(dadosCliente) {
  if (!dadosCliente.nome) {
    return "Nome é obrigatório.";
  }

  if (!dadosCliente.celular) {
    return "Celular é obrigatório.";
  }

  if (!dadosCliente.cpf) {
    return "CPF/CNPJ é obrigatório.";
  }

  if (![11, 14].includes(dadosCliente.cpfLimpo.length)) {
    return "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos.";
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
    const cpfDuplicado = await clientesService.cpfJaExiste(
      dadosCliente.cpfLimpo,
      clienteEditando,
    );

    if (cpfDuplicado) {
      mostrarMensagem(
        "Erro",
        "Já existe um cliente cadastrado com este CPF/CNPJ.",
        "error",
      );
      document.getElementById("cpf").focus();
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
        const nome = escaparHTML(cliente.nome);
        const email = escaparHTML(cliente.email);
        const cpf = escaparHTML(cliente.cpf);
        const celular = escaparHTML(cliente.celular);
        const cidade = escaparHTML(cliente.cidade);
        const estado = escaparHTML(cliente.estado);

        return `
          <tr class="${cliente.estaNoSpc ? "cliente-spc-row" : ""}">
            <td>
              <strong class="${cliente.estaNoSpc ? "cliente-nome-spc" : ""}">
                ${nome}
              </strong>

              ${
                cliente.estaNoSpc
                  ? `<span class="badge-spc">
                      <i class="fas fa-ban"></i> SPC
                    </span>`
                  : ""
              }

              ${email ? `<br><small>${email}</small>` : ""}
            </td>

            <td>${cpf}</td>
            <td>${celular}</td>
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

    preencherCampo("nome", cliente.nome);
    preencherCampo("dataNascimento", cliente.dataNascimento);
    preencherCampo("cpf", cliente.cpf);
    preencherCampo("identidade", cliente.identidade);
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
