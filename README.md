# Ouro Rifa - API Backend

API completa para sistema de rifas online desenvolvida em Node.js + Express.

## 🚀 Tecnologias

- Node.js + Express
- Armazenamento em JSON (migração futura para MongoDB)
- JWT para autenticação
- Multer para upload de imagens
- Swagger para documentação da API
- Helmet e Rate Limiting para segurança

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Executar em modo de desenvolvimento
npm run dev

# Executar em produção
npm start
```

## 📚 Documentação da API

A documentação completa da API está disponível via Swagger UI:

- **Local**: http://localhost:3000/api-docs
- **Produção**: https://api.ourorifa.com/api-docs

## 🔗 Endpoints Principais

### Autenticação
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Perfil do usuário
- `PUT /api/auth/profile` - Atualizar perfil
- `PUT /api/auth/change-password` - Alterar senha

### Rifas
- `GET /api/raffles` - Listar rifas
- `GET /api/raffles/:id` - Obter rifa específica
- `POST /api/raffles` - Criar rifa
- `PUT /api/raffles/:id` - Atualizar rifa
- `DELETE /api/raffles/:id` - Excluir rifa
- `POST /api/raffles/:id/draw` - Realizar sorteio

### Tickets
- `GET /api/tickets` - Listar tickets
- `POST /api/tickets` - Comprar tickets
- `GET /api/tickets/:id` - Obter ticket
- `PUT /api/tickets/:id/cancel` - Cancelar ticket

### Pagamentos
- `POST /api/payments/pix` - Gerar PIX
- `POST /api/payments/confirm` - Confirmar pagamento
- `GET /api/payments/:id` - Status do pagamento

### Relatórios (Admin)
- `GET /api/reports/dashboard` - Dashboard
- `GET /api/reports/sales` - Relatório de vendas
- `GET /api/reports/revenue` - Relatório de receita

### Upload
- `POST /api/upload/image` - Upload de imagem

## 🔐 Autenticação

A API utiliza JWT (JSON Web Tokens) para autenticação. Para acessar endpoints protegidos, inclua o token no header:

```
Authorization: Bearer <seu_token_jwt>
```

## 📊 Funcionalidades

- ✅ Sistema de autenticação completo
- ✅ Gerenciamento de rifas
- ✅ Sistema de tickets com numeração automática
- ✅ Pagamentos via PIX com QR Code
- ✅ Sorteio automático e aleatório
- ✅ Upload de imagens
- ✅ Relatórios administrativos
- ✅ Rate limiting e segurança
- ✅ Logs detalhados
- ✅ Documentação Swagger

## 🛠️ Estrutura do Projeto

```
ouro-rifa-api/
├── src/
│   ├── config/
│   │   └── swagger.js          # Configuração do Swagger
│   ├── controllers/            # Controladores da API
│   ├── middleware/             # Middlewares (auth, validação)
│   ├── routes/                 # Rotas da API
│   ├── utils/                  # Utilitários (dataManager, helpers, logger)
│   └── data/                   # Arquivos JSON de dados
├── uploads/                    # Arquivos de upload
├── logs/                       # Logs da aplicação
├── .env                        # Variáveis de ambiente
├── server.js                   # Servidor principal
└── package.json               # Dependências
```

## 🔧 Configuração

Configure as variáveis de ambiente no arquivo `.env`:

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8080

# JWT
JWT_SECRET=ouro_rifa_super_secret_key_2024
JWT_EXPIRES_IN=7d

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_app
EMAIL_FROM=noreply@ourorifa.com

# PIX
PIX_KEY=seu_pix@email.com
PIX_BANK_NAME=Seu Banco
PIX_ACCOUNT_NAME=Sua Empresa

# Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=jpg,jpeg,png,webp
```

## 🚦 Health Check

Verifique se a API está funcionando:

```bash
GET /health
```

Resposta:
```json
{
  "status": "OK",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

## 📝 Logs

Os logs são salvos em:
- `logs/combined.log` - Todos os logs
- `logs/error.log` - Apenas erros

## 🔒 Segurança

- Rate limiting (100 requests por 15 minutos)
- Helmet.js para headers de segurança
- Validação de dados com Joi
- Hash de senhas com bcrypt
- JWT para autenticação
- CORS configurado

## 📱 Frontend

Esta API foi desenvolvida para trabalhar com o painel administrativo Vue.js do Ouro Rifa.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.