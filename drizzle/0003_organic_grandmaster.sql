CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`base_currency` text NOT NULL,
	`quote_currency` text NOT NULL,
	`rate_decimal` text NOT NULL,
	`reference_date` text NOT NULL,
	`provider` text NOT NULL,
	`fetched_at` text NOT NULL,
	`is_stale` integer DEFAULT false NOT NULL,
	`source_hash` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "exchange_rates_currency_pair_check" CHECK(length("exchange_rates"."base_currency") = 3 and length("exchange_rates"."quote_currency") = 3 and "exchange_rates"."base_currency" <> "exchange_rates"."quote_currency"),
	CONSTRAINT "exchange_rates_is_stale_check" CHECK("exchange_rates"."is_stale" in (0, 1)),
	CONSTRAINT "exchange_rates_rate_decimal_check" CHECK(cast("exchange_rates"."rate_decimal" as real) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rates_user_id_idx` ON `exchange_rates` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `exchange_rates_user_pair_reference_idx` ON `exchange_rates` (`user_id`,`base_currency`,`quote_currency`,`reference_date`);
