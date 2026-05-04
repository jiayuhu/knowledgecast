PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_image_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_item_id` text NOT NULL,
	`image_path` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`knowledge_item_id`) REFERENCES `knowledge_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_image_refs`("id", "knowledge_item_id", "image_path", "created_at") SELECT "id", "knowledge_item_id", "image_path", "created_at" FROM `image_refs`;--> statement-breakpoint
DROP TABLE `image_refs`;--> statement-breakpoint
ALTER TABLE `__new_image_refs` RENAME TO `image_refs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;