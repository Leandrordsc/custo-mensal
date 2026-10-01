PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`account_type` text NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`balance_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "accounts_account_type_check" CHECK("__new_accounts"."account_type" in ('CONTA', 'CAIXINHA', 'RESERVA', 'INVESTIMENTO')),
	CONSTRAINT "accounts_currency_check" CHECK(length("__new_accounts"."currency") = 3)
);
--> statement-breakpoint
INSERT INTO `__new_accounts`("id", "user_id", "name", "account_type", "currency", "opening_balance_cents", "balance_date", "active") SELECT "id", "user_id", "name", "account_type", "currency", "opening_balance_cents", "balance_date", "active" FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_name_idx` ON `accounts` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_asset_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`price_decimal` text NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`quoted_at` text NOT NULL,
	`provider` text NOT NULL,
	`fetched_at` text NOT NULL,
	`is_stale` integer DEFAULT false NOT NULL,
	`source_hash` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`asset_id`) REFERENCES `assets`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "asset_prices_currency_check" CHECK(length("__new_asset_prices"."currency") = 3)
);
--> statement-breakpoint
INSERT INTO `__new_asset_prices`("id", "user_id", "asset_id", "price_decimal", "currency", "quoted_at", "provider", "fetched_at", "is_stale", "source_hash") SELECT "id", "user_id", "asset_id", "price_decimal", "currency", "quoted_at", "provider", "fetched_at", "is_stale", "source_hash" FROM `asset_prices`;--> statement-breakpoint
DROP TABLE `asset_prices`;--> statement-breakpoint
ALTER TABLE `__new_asset_prices` RENAME TO `asset_prices`;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_prices_user_id_idx` ON `asset_prices` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `asset_prices_user_asset_fetched_idx` ON `asset_prices` (`user_id`,`asset_id`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `__new_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`ticker` text,
	`name` text NOT NULL,
	`asset_class` text NOT NULL,
	`exchange` text,
	`market` text,
	`currency` text DEFAULT 'BRL' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assets_currency_check" CHECK(length("__new_assets"."currency") = 3)
);
--> statement-breakpoint
INSERT INTO `__new_assets`("id", "user_id", "ticker", "name", "asset_class", "exchange", "market", "currency") SELECT "id", "user_id", "ticker", "name", "asset_class", "exchange", "market", "currency" FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_user_id_idx` ON `assets` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_user_ticker_market_idx` ON `assets` (`user_id`,`ticker`,`exchange`,`market`);--> statement-breakpoint
CREATE TABLE `__new_card_installments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_purchase_id` text NOT NULL,
	`card_statement_id` text,
	`transaction_id` text NOT NULL,
	`installment_number` integer NOT NULL,
	`total_installments` integer NOT NULL,
	`statement_month` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_purchase_id`) REFERENCES `card_purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_statement_id`) REFERENCES `card_statements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_purchase_id`) REFERENCES `card_purchases`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`card_statement_id`) REFERENCES `card_statements`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`transaction_id`) REFERENCES `transactions`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "card_installments_amount_cents_check" CHECK("__new_card_installments"."amount_cents" >= 0),
	CONSTRAINT "card_installments_installment_number_check" CHECK("__new_card_installments"."installment_number" >= 1),
	CONSTRAINT "card_installments_total_installments_check" CHECK("__new_card_installments"."total_installments" >= 1),
	CONSTRAINT "card_installments_bounds_check" CHECK("__new_card_installments"."installment_number" <= "__new_card_installments"."total_installments")
);
--> statement-breakpoint
INSERT INTO `__new_card_installments`("id", "user_id", "card_purchase_id", "card_statement_id", "transaction_id", "installment_number", "total_installments", "statement_month", "amount_cents") SELECT "id", "user_id", "card_purchase_id", "card_statement_id", "transaction_id", "installment_number", "total_installments", "statement_month", "amount_cents" FROM `card_installments`;--> statement-breakpoint
DROP TABLE `card_installments`;--> statement-breakpoint
ALTER TABLE `__new_card_installments` RENAME TO `card_installments`;--> statement-breakpoint
CREATE UNIQUE INDEX `card_installments_user_id_idx` ON `card_installments` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_installments_user_purchase_number_idx` ON `card_installments` (`user_id`,`card_purchase_id`,`installment_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_installments_transaction_idx` ON `card_installments` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `__new_card_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`purchase_date` text NOT NULL,
	`description` text NOT NULL,
	`total_amount_cents` integer NOT NULL,
	`total_installments` integer DEFAULT 1 NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`parent_purchase_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`parent_purchase_id`) REFERENCES `card_purchases`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "card_purchases_total_amount_cents_check" CHECK("__new_card_purchases"."total_amount_cents" >= 0),
	CONSTRAINT "card_purchases_currency_check" CHECK(length("__new_card_purchases"."currency") = 3),
	CONSTRAINT "card_purchases_total_installments_check" CHECK("__new_card_purchases"."total_installments" >= 1),
	CONSTRAINT "card_purchases_parent_not_self_check" CHECK("__new_card_purchases"."parent_purchase_id" is null or "__new_card_purchases"."parent_purchase_id" <> "__new_card_purchases"."id")
);
--> statement-breakpoint
INSERT INTO `__new_card_purchases`("id", "user_id", "card_id", "purchase_date", "description", "total_amount_cents", "total_installments", "currency", "parent_purchase_id") SELECT "id", "user_id", "card_id", "purchase_date", "description", "total_amount_cents", "total_installments", "currency", "parent_purchase_id" FROM `card_purchases`;--> statement-breakpoint
DROP TABLE `card_purchases`;--> statement-breakpoint
ALTER TABLE `__new_card_purchases` RENAME TO `card_purchases`;--> statement-breakpoint
CREATE UNIQUE INDEX `card_purchases_user_id_idx` ON `card_purchases` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_card_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`cashback_rate_bps` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "card_rules_cashback_rate_bps_check" CHECK("__new_card_rules"."cashback_rate_bps" between 0 and 10000)
);
--> statement-breakpoint
INSERT INTO `__new_card_rules`("id", "user_id", "card_id", "cashback_rate_bps", "valid_from", "valid_to") SELECT "id", "user_id", "card_id", "cashback_rate_bps", "valid_from", "valid_to" FROM `card_rules`;--> statement-breakpoint
DROP TABLE `card_rules`;--> statement-breakpoint
ALTER TABLE `__new_card_rules` RENAME TO `card_rules`;--> statement-breakpoint
CREATE UNIQUE INDEX `card_rules_user_id_idx` ON `card_rules` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `card_rules_card_period_idx` ON `card_rules` (`user_id`,`card_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `__new_card_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`statement_month` text NOT NULL,
	`closing_date` text NOT NULL,
	`due_date` text NOT NULL,
	`payment_transaction_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`payment_transaction_id`) REFERENCES `transactions`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_card_statements`("id", "user_id", "card_id", "statement_month", "closing_date", "due_date", "payment_transaction_id") SELECT "id", "user_id", "card_id", "statement_month", "closing_date", "due_date", "payment_transaction_id" FROM `card_statements`;--> statement-breakpoint
DROP TABLE `card_statements`;--> statement-breakpoint
ALTER TABLE `__new_card_statements` RENAME TO `card_statements`;--> statement-breakpoint
CREATE UNIQUE INDEX `card_statements_user_id_idx` ON `card_statements` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_statements_user_card_month_idx` ON `card_statements` (`user_id`,`card_id`,`statement_month`);--> statement-breakpoint
CREATE TABLE `__new_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`issuer` text,
	`status` text DEFAULT 'ATIVO' NOT NULL,
	`closing_day` integer NOT NULL,
	`due_day` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cards_status_check" CHECK("__new_cards"."status" in ('ATIVO', 'HISTORICO', 'ARQUIVADO')),
	CONSTRAINT "cards_closing_day_check" CHECK("__new_cards"."closing_day" between 1 and 31),
	CONSTRAINT "cards_due_day_check" CHECK("__new_cards"."due_day" between 1 and 31)
);
--> statement-breakpoint
INSERT INTO `__new_cards`("id", "user_id", "name", "issuer", "status", "closing_day", "due_day") SELECT "id", "user_id", "name", "issuer", "status", "closing_day", "due_day" FROM `cards`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint
CREATE UNIQUE INDEX `cards_user_id_idx` ON `cards` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_user_name_idx` ON `cards` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_cashback_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text,
	`card_id` text NOT NULL,
	`month` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`value_type` text NOT NULL,
	`rule_id` text,
	`contabilizable` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_id`) REFERENCES `card_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`transaction_id`) REFERENCES `transactions`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`rule_id`) REFERENCES `card_rules`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cashback_events_value_type_check" CHECK("__new_cashback_events"."value_type" in ('REAL', 'ESTIMADO')),
	CONSTRAINT "cashback_events_amount_cents_check" CHECK("__new_cashback_events"."amount_cents" >= 0),
	CONSTRAINT "cashback_events_contabilizable_check" CHECK("__new_cashback_events"."contabilizable" in (0, 1)),
	CONSTRAINT "cashback_events_value_consistency_check" CHECK((("__new_cashback_events"."value_type" = 'ESTIMADO' and "__new_cashback_events"."transaction_id" is null and "__new_cashback_events"."contabilizable" = 0) or ("__new_cashback_events"."value_type" = 'REAL' and "__new_cashback_events"."transaction_id" is not null and "__new_cashback_events"."contabilizable" = 1)))
);
--> statement-breakpoint
INSERT INTO `__new_cashback_events`("id", "user_id", "transaction_id", "card_id", "month", "amount_cents", "value_type", "rule_id", "contabilizable") SELECT "id", "user_id", "transaction_id", "card_id", "month", "amount_cents", "value_type", "rule_id", "contabilizable" FROM `cashback_events`;--> statement-breakpoint
DROP TABLE `cashback_events`;--> statement-breakpoint
ALTER TABLE `__new_cashback_events` RENAME TO `cashback_events`;--> statement-breakpoint
CREATE UNIQUE INDEX `cashback_events_user_id_idx` ON `cashback_events` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cashback_events_transaction_idx` ON `cashback_events` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `cashback_events_user_card_month_idx` ON `cashback_events` (`user_id`,`card_id`,`month`);--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`counts_as_living_cost` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`parent_id`) REFERENCES `categories`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "categories_parent_not_self_check" CHECK("__new_categories"."parent_id" is null or "__new_categories"."parent_id" <> "__new_categories"."id")
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "user_id", "name", "parent_id", "counts_as_living_cost", "active") SELECT "id", "user_id", "name", "parent_id", "counts_as_living_cost", "active" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_id_idx` ON `categories` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_idx` ON `categories` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_classification_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pattern` text NOT NULL,
	`nature` text NOT NULL,
	`subtype` text NOT NULL,
	`origin` text NOT NULL,
	`category_id` text,
	`confidence` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`category_id`) REFERENCES `categories`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "classification_rules_nature_check" CHECK("__new_classification_rules"."nature" in ('DESPESA', 'RECEITA', 'TRANSFERENCIA', 'INVESTIMENTO')),
	CONSTRAINT "classification_rules_subtype_check" CHECK("__new_classification_rules"."subtype" in ('COMPRA', 'APORTE', 'REINVESTIMENTO', 'PAGAMENTO_FATURA', 'TRANSFERENCIA_RESERVA', 'DIVIDENDO', 'CASHBACK', 'RENDIMENTO', 'AJUSTE')),
	CONSTRAINT "classification_rules_origin_check" CHECK("__new_classification_rules"."origin" in ('CONTA', 'CARTAO', 'CAIXINHA', 'IMPORTACAO', 'MANUAL')),
	CONSTRAINT "classification_rules_confidence_check" CHECK("__new_classification_rules"."confidence" between 0 and 100)
);
--> statement-breakpoint
INSERT INTO `__new_classification_rules`("id", "user_id", "pattern", "nature", "subtype", "origin", "category_id", "confidence", "active") SELECT "id", "user_id", "pattern", "nature", "subtype", "origin", "category_id", "confidence", "active" FROM `classification_rules`;--> statement-breakpoint
DROP TABLE `classification_rules`;--> statement-breakpoint
ALTER TABLE `__new_classification_rules` RENAME TO `classification_rules`;--> statement-breakpoint
CREATE UNIQUE INDEX `classification_rules_user_id_idx` ON `classification_rules` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `classification_rules_user_pattern_idx` ON `classification_rules` (`user_id`,`pattern`);--> statement-breakpoint
CREATE TABLE `__new_dividend_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`declared_date` text,
	`payment_date` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`transaction_id`) REFERENCES `transactions`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`asset_id`) REFERENCES `assets`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_dividend_events`("id", "user_id", "transaction_id", "asset_id", "declared_date", "payment_date") SELECT "id", "user_id", "transaction_id", "asset_id", "declared_date", "payment_date" FROM `dividend_events`;--> statement-breakpoint
DROP TABLE `dividend_events`;--> statement-breakpoint
ALTER TABLE `__new_dividend_events` RENAME TO `dividend_events`;--> statement-breakpoint
CREATE UNIQUE INDEX `dividend_events_user_id_idx` ON `dividend_events` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dividend_events_transaction_idx` ON `dividend_events` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `dividend_events_user_asset_payment_idx` ON `dividend_events` (`user_id`,`asset_id`,`payment_date`);--> statement-breakpoint
CREATE TABLE `__new_import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_file_name` text NOT NULL,
	`source_file_size` integer NOT NULL,
	`file_hash` text NOT NULL,
	`parser_version` text NOT NULL,
	`status` text DEFAULT 'STAGED' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`confirmed_at` text,
	`confirmed_by` text,
	`error_summary` text,
	`rows_total` integer DEFAULT 0 NOT NULL,
	`rows_accepted` integer DEFAULT 0 NOT NULL,
	`rows_rejected` integer DEFAULT 0 NOT NULL,
	`rows_pending` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "import_batches_status_check" CHECK("__new_import_batches"."status" in ('STAGED', 'READY_FOR_REVIEW', 'CONFIRMED', 'FAILED', 'ROLLED_BACK')),
	CONSTRAINT "import_batches_source_file_size_check" CHECK("__new_import_batches"."source_file_size" >= 0),
	CONSTRAINT "import_batches_counters_check" CHECK("__new_import_batches"."rows_total" >= 0 and "__new_import_batches"."rows_accepted" >= 0 and "__new_import_batches"."rows_rejected" >= 0 and "__new_import_batches"."rows_pending" >= 0),
	CONSTRAINT "import_batches_confirmed_audit_check" CHECK((("__new_import_batches"."status" = 'CONFIRMED' and "__new_import_batches"."confirmed_at" is not null and "__new_import_batches"."confirmed_by" is not null and "__new_import_batches"."confirmed_by" = "__new_import_batches"."user_id") or ("__new_import_batches"."status" <> 'CONFIRMED' and "__new_import_batches"."confirmed_at" is null and "__new_import_batches"."confirmed_by" is null)))
);
--> statement-breakpoint
INSERT INTO `__new_import_batches`("id", "user_id", "source_file_name", "source_file_size", "file_hash", "parser_version", "status", "started_at", "completed_at", "confirmed_at", "confirmed_by", "error_summary", "rows_total", "rows_accepted", "rows_rejected", "rows_pending") SELECT "id", "user_id", "source_file_name", "source_file_size", "file_hash", "parser_version", "status", "started_at", "completed_at", "confirmed_at", "confirmed_by", "error_summary", "rows_total", "rows_accepted", "rows_rejected", "rows_pending" FROM `import_batches`;--> statement-breakpoint
DROP TABLE `import_batches`;--> statement-breakpoint
ALTER TABLE `__new_import_batches` RENAME TO `import_batches`;--> statement-breakpoint
CREATE UNIQUE INDEX `import_batches_user_id_idx` ON `import_batches` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `import_batches_user_file_hash_idx` ON `import_batches` (`user_id`,`file_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `import_batches_user_active_file_hash_idx` ON `import_batches` (`user_id`,`file_hash`) WHERE "import_batches"."status" in ('STAGED', 'READY_FOR_REVIEW', 'CONFIRMED');--> statement-breakpoint
CREATE TABLE `__new_import_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`sheet_name` text NOT NULL,
	`cell_ref` text,
	`raw_label` text,
	`raw_value` text,
	`raw_row_hash` text NOT NULL,
	`logical_fingerprint` text NOT NULL,
	`suggested_nature` text,
	`suggested_subtype` text,
	`suggested_origin` text,
	`classification_status` text NOT NULL,
	`normalized_amount_cents` integer,
	`status` text DEFAULT 'PENDENTE' NOT NULL,
	`issue` text,
	`transaction_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`batch_id`) REFERENCES `import_batches`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`transaction_id`) REFERENCES `transactions`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "import_rows_suggested_nature_check" CHECK("__new_import_rows"."suggested_nature" is null or "__new_import_rows"."suggested_nature" in ('DESPESA', 'RECEITA', 'TRANSFERENCIA', 'INVESTIMENTO')),
	CONSTRAINT "import_rows_suggested_subtype_check" CHECK("__new_import_rows"."suggested_subtype" is null or "__new_import_rows"."suggested_subtype" in ('COMPRA', 'APORTE', 'REINVESTIMENTO', 'PAGAMENTO_FATURA', 'TRANSFERENCIA_RESERVA', 'DIVIDENDO', 'CASHBACK', 'RENDIMENTO', 'AJUSTE')),
	CONSTRAINT "import_rows_suggested_origin_check" CHECK("__new_import_rows"."suggested_origin" is null or "__new_import_rows"."suggested_origin" in ('CONTA', 'CARTAO', 'CAIXINHA', 'IMPORTACAO', 'MANUAL')),
	CONSTRAINT "import_rows_classification_status_check" CHECK("__new_import_rows"."classification_status" in ('CONFIRMADO', 'ESTIMADO', 'PENDENTE_REVISAO', 'REJEITADO')),
	CONSTRAINT "import_rows_status_check" CHECK("__new_import_rows"."status" in ('PENDENTE', 'ACEITO', 'REJEITADO', 'CONFIRMADO')),
	CONSTRAINT "import_rows_normalized_amount_cents_check" CHECK("__new_import_rows"."normalized_amount_cents" is null or "__new_import_rows"."normalized_amount_cents" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_import_rows`("id", "user_id", "batch_id", "sheet_name", "cell_ref", "raw_label", "raw_value", "raw_row_hash", "logical_fingerprint", "suggested_nature", "suggested_subtype", "suggested_origin", "classification_status", "normalized_amount_cents", "status", "issue", "transaction_id") SELECT "id", "user_id", "batch_id", "sheet_name", "cell_ref", "raw_label", "raw_value", "raw_row_hash", "logical_fingerprint", "suggested_nature", "suggested_subtype", "suggested_origin", "classification_status", "normalized_amount_cents", "status", "issue", "transaction_id" FROM `import_rows`;--> statement-breakpoint
DROP TABLE `import_rows`;--> statement-breakpoint
ALTER TABLE `__new_import_rows` RENAME TO `import_rows`;--> statement-breakpoint
CREATE UNIQUE INDEX `import_rows_user_id_idx` ON `import_rows` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `import_rows_user_batch_row_hash_idx` ON `import_rows` (`user_id`,`batch_id`,`raw_row_hash`);--> statement-breakpoint
CREATE INDEX `import_rows_user_logical_fingerprint_idx` ON `import_rows` (`user_id`,`logical_fingerprint`);--> statement-breakpoint
CREATE TABLE `__new_investment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`quantity_decimal` text,
	`unit_price_decimal` text,
	`exchange_rate_decimal` text,
	`gross_amount_cents` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`transaction_id`) REFERENCES `transactions`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`asset_id`) REFERENCES `assets`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "investment_events_gross_amount_cents_check" CHECK("__new_investment_events"."gross_amount_cents" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_investment_events`("id", "user_id", "transaction_id", "asset_id", "quantity_decimal", "unit_price_decimal", "exchange_rate_decimal", "gross_amount_cents") SELECT "id", "user_id", "transaction_id", "asset_id", "quantity_decimal", "unit_price_decimal", "exchange_rate_decimal", "gross_amount_cents" FROM `investment_events`;--> statement-breakpoint
DROP TABLE `investment_events`;--> statement-breakpoint
ALTER TABLE `__new_investment_events` RENAME TO `investment_events`;--> statement-breakpoint
CREATE UNIQUE INDEX `investment_events_user_id_idx` ON `investment_events` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `investment_events_transaction_idx` ON `investment_events` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `investment_events_user_asset_idx` ON `investment_events` (`user_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `__new_reserve_earnings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`month` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`transaction_id`) REFERENCES `transactions`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`account_id`) REFERENCES `accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_reserve_earnings`("id", "user_id", "transaction_id", "account_id", "month") SELECT "id", "user_id", "transaction_id", "account_id", "month" FROM `reserve_earnings`;--> statement-breakpoint
DROP TABLE `reserve_earnings`;--> statement-breakpoint
ALTER TABLE `__new_reserve_earnings` RENAME TO `reserve_earnings`;--> statement-breakpoint
CREATE UNIQUE INDEX `reserve_earnings_user_id_idx` ON `reserve_earnings` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reserve_earnings_transaction_idx` ON `reserve_earnings` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `reserve_earnings_user_account_month_idx` ON `reserve_earnings` (`user_id`,`account_id`,`month`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nature` text NOT NULL,
	`subtype` text NOT NULL,
	`origin` text NOT NULL,
	`classification_status` text NOT NULL,
	`transaction_status` text DEFAULT 'ACTIVE' NOT NULL,
	`category_id` text,
	`source_account_id` text,
	`target_account_id` text,
	`card_id` text,
	`asset_id` text,
	`date` text NOT NULL,
	`competence_month` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`direction` text NOT NULL,
	`source_hash` text,
	`logical_fingerprint` text,
	`voided_at` text,
	`voided_by` text,
	`reversal_transaction_id` text,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`category_id`) REFERENCES `categories`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`source_account_id`) REFERENCES `accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`target_account_id`) REFERENCES `accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`asset_id`) REFERENCES `assets`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`,`reversal_transaction_id`) REFERENCES `transactions`(`user_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "transactions_nature_check" CHECK("__new_transactions"."nature" in ('DESPESA', 'RECEITA', 'TRANSFERENCIA', 'INVESTIMENTO')),
	CONSTRAINT "transactions_subtype_check" CHECK("__new_transactions"."subtype" in ('COMPRA', 'APORTE', 'REINVESTIMENTO', 'PAGAMENTO_FATURA', 'TRANSFERENCIA_RESERVA', 'DIVIDENDO', 'CASHBACK', 'RENDIMENTO', 'AJUSTE')),
	CONSTRAINT "transactions_origin_check" CHECK("__new_transactions"."origin" in ('CONTA', 'CARTAO', 'CAIXINHA', 'IMPORTACAO', 'MANUAL')),
	CONSTRAINT "transactions_classification_status_check" CHECK("__new_transactions"."classification_status" in ('CONFIRMADO', 'ESTIMADO', 'PENDENTE_REVISAO', 'REJEITADO')),
	CONSTRAINT "transactions_transaction_status_check" CHECK("__new_transactions"."transaction_status" in ('ACTIVE', 'CANCELADO', 'ESTORNADO')),
	CONSTRAINT "transactions_direction_check" CHECK("__new_transactions"."direction" in ('INFLOW', 'OUTFLOW', 'TRANSFER_OUT', 'TRANSFER_IN', 'NEUTRAL')),
	CONSTRAINT "transactions_currency_check" CHECK(length("__new_transactions"."currency") = 3),
	CONSTRAINT "transactions_amount_cents_check" CHECK("__new_transactions"."amount_cents" >= 0),
	CONSTRAINT "transactions_reversal_not_self_check" CHECK("__new_transactions"."reversal_transaction_id" is null or "__new_transactions"."reversal_transaction_id" <> "__new_transactions"."id"),
	CONSTRAINT "transactions_voided_audit_check" CHECK((("__new_transactions"."voided_at" is null and "__new_transactions"."voided_by" is null) or ("__new_transactions"."voided_at" is not null and "__new_transactions"."voided_by" is not null and "__new_transactions"."voided_by" = "__new_transactions"."user_id")))
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "user_id", "nature", "subtype", "origin", "classification_status", "transaction_status", "category_id", "source_account_id", "target_account_id", "card_id", "asset_id", "date", "competence_month", "description", "amount_cents", "currency", "direction", "source_hash", "logical_fingerprint", "voided_at", "voided_by", "reversal_transaction_id", "notes") SELECT "id", "user_id", "nature", "subtype", "origin", "classification_status", "transaction_status", "category_id", "source_account_id", "target_account_id", "card_id", "asset_id", "date", "competence_month", "description", "amount_cents", "currency", "direction", "source_hash", "logical_fingerprint", "voided_at", "voided_by", "reversal_transaction_id", "notes" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_user_id_idx` ON `transactions` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `transactions_user_date_idx` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_user_competence_idx` ON `transactions` (`user_id`,`competence_month`);--> statement-breakpoint
CREATE INDEX `transactions_user_classification_idx` ON `transactions` (`user_id`,`nature`,`subtype`,`competence_month`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_user_source_hash_idx` ON `transactions` (`user_id`,`source_hash`);--> statement-breakpoint
CREATE INDEX `transactions_user_logical_fingerprint_idx` ON `transactions` (`user_id`,`logical_fingerprint`);--> statement-breakpoint
CREATE TRIGGER `transactions_reversal_no_two_cycle_insert`
BEFORE INSERT ON `transactions`
WHEN NEW.`reversal_transaction_id` IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM `transactions` previous
    WHERE previous.`user_id` = NEW.`user_id`
      AND previous.`id` = NEW.`reversal_transaction_id`
      AND previous.`reversal_transaction_id` = NEW.`id`
  )
BEGIN
  SELECT RAISE(ABORT, 'transactions reversal cycle');
END;--> statement-breakpoint
CREATE TRIGGER `transactions_reversal_no_two_cycle_update`
BEFORE UPDATE OF `reversal_transaction_id` ON `transactions`
WHEN NEW.`reversal_transaction_id` IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM `transactions` previous
    WHERE previous.`user_id` = NEW.`user_id`
      AND previous.`id` = NEW.`reversal_transaction_id`
      AND previous.`reversal_transaction_id` = NEW.`id`
  )
BEGIN
  SELECT RAISE(ABORT, 'transactions reversal cycle');
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
