# ADM-Coturnos-cia_FrontBack

Repositório unificado contendo o **Painel Administrativo (Front-end)** e a **API RESTful (Back-end)** da plataforma **Coturnos & Cia**.

---

## 📁 Estrutura do Repositório

```plaintext
ADM-Coturnos-cia_FrontBack/
├── backend-api/                         # Back-end em Laravel / PHP
│   ├── app/Http/Controllers/            # Controllers da API (Admin, Dashboard, etc.)
│   ├── routes/                          # Definições de rotas da API
│   ├── database/                        # Migrations, seeders e factories
│   └── .env.example                     # Exemplo de configuração de ambiente
│
└── front-end admin/                     # Front-end Painel Admin
    └── Admin_Coturno-main/              # Aplicação React + Vite + TypeScript
        ├── src/                         # Componentes, páginas e hooks
        ├── package.json                 # Dependências e scripts
        └── vite.config.js               # Configuração do Vite
```

---

## 🚀 Como Executar

### 1. Back-end (Laravel)

```bash
cd backend-api

# Instalar dependências
composer install

# Configurar o ambiente
cp .env.example .env
php artisan key:generate

# Executar migrações
php artisan migrate

# Iniciar o servidor de desenvolvimento
php artisan serve
```

### 2. Front-end Admin (React + Vite)

```bash
cd "front-end admin/Admin_Coturno-main"

# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

---

## 🔒 Segurança e Boas Práticas

- Arquivos de configuração sensíveis (`.env`), certificados e chaves privadas estão devidamente protegidos no `.gitignore`.
- Nunca commite senhas, tokens de acesso ou credenciais de banco de dados.
