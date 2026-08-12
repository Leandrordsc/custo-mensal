CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`account_type` text NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`balance_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_name_idx` ON `accounts` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `asset_prices` (
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
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `asset_prices_user_asset_fetched_idx` ON `asset_prices` (`user_id`,`asset_id`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`ticker` text,
	`name` text NOT NULL,
	`asset_class` text NOT NULL,
	`exchange` text,
	`market` text,
	`currency` text DEFAULT 'BRL' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_user_ticker_market_idx` ON `assets` (`user_id`,`ticker`,`exchange`,`market`);--> statement-breakpoint
CREATE TABLE `card_installments` (
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
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_installments_user_purchase_number_idx` ON `card_installments` (`user_id`,`card_purchase_id`,`installment_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_installments_transaction_idx` ON `card_installments` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `card_purchases` (
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
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `card_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`cashback_rate_bps` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `card_rules_card_period_idx` ON `card_rules` (`user_id`,`card_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `card_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`statement_month` text NOT NULL,
	`closing_date` text NOT NULL,
	`due_date` text NOT NULL,
	`payment_transaction_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_statements_user_card_month_idx` ON `card_statements` (`user_id`,`card_id`,`statement_month`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`issuer` text,
	`status` text DEFAULT 'ATIVO' NOT NULL,
	`closing_day` integer NOT NULL,
	`due_day` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_user_name_idx` ON `cards` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `cashback_events` (
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
	FOREIGN KEY (`rule_id`) REFERENCES `card_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cashback_events_transaction_idx` ON `cashback_events` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `cashback_events_user_card_month_idx` ON `cashback_events` (`user_id`,`card_id`,`month`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`counts_as_living_cost` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_idx` ON `categories` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `classification_rules` (
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
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `classification_rules_user_pattern_idx` ON `classification_rules` (`user_id`,`pattern`);--> statement-breakpoint
CREATE TABLE `dividend_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`declared_date` text,
	`payment_date` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dividend_events_transaction_idx` ON `dividend_events` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `dividend_events_user_asset_payment_idx` ON `dividend_events` (`user_id`,`asset_id`,`payment_date`);--> statement-breakpoint
CREATE TABLE `import_batches` (
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
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `import_batches_user_file_hash_idx` ON `import_batches` (`user_id`,`file_hash`);--> statement-breakpoint
CREATE TABLE `import_rows` (
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
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_rows_user_batch_row_hash_idx` ON `import_rows` (`user_id`,`batch_id`,`raw_row_hash`);--> statement-breakpoint
CREATE INDEX `import_rows_user_logical_fingerprint_idx` ON `import_rows` (`user_id`,`logical_fingerprint`);--> statement-breakpoint
CREATE TABLE `investment_events` (
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
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investment_events_transaction_idx` ON `investment_events` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `investment_events_user_asset_idx` ON `investment_events` (`user_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `reserve_earnings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`month` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reserve_earnings_transaction_idx` ON `reserve_earnings` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `reserve_earnings_user_account_month_idx` ON `reserve_earnings` (`user_id`,`account_id`,`month`);--> statement-breakpoint
CREATE TABLE `transactions` (
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
	FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_user_date_idx` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_user_competence_idx` ON `transactions` (`user_id`,`competence_month`);--> statement-breakpoint
CREATE INDEX `transactions_user_classification_idx` ON `transactions` (`user_id`,`nature`,`subtype`,`competence_month`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_user_source_hash_idx` ON `transactions` (`user_id`,`source_hash`);--> statement-breakpoint
CREATE INDEX `transactions_user_logical_fingerprint_idx` ON `transactions` (`user_id`,`logical_fingerprint`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);