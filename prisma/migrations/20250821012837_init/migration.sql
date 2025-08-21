-- CreateTable
CREATE TABLE "category_cost_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category_id" INTEGER NOT NULL,
    "cost" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "company_id" INTEGER NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "product_cost_overrides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_tmpl_id" INTEGER NOT NULL,
    "cost" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "company_id" INTEGER NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sync_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executed_by" TEXT NOT NULL,
    "executed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" INTEGER NOT NULL,
    "items_total" INTEGER NOT NULL,
    "items_updated" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "use_accounting_revaluation" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "meta" TEXT
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" DATETIME,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "company_id" INTEGER
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "category_cost_rules_category_id_company_id_key" ON "category_cost_rules"("category_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_cost_overrides_product_tmpl_id_company_id_key" ON "product_cost_overrides"("product_tmpl_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");
