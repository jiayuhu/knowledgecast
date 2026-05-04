CREATE TABLE `image_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_item_id` text NOT NULL,
	`image_path` text NOT NULL,
	`created_at` integer NOT NULL
);
