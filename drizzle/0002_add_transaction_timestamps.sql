ALTER TABLE `transactions` ADD `created_at` text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `updated_at` text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL;
