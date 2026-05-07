ALTER TABLE `workspaces` RENAME TO `collections`;--> statement-breakpoint
ALTER TABLE `knowledge_items` RENAME COLUMN `workspace_id` TO `collection_id`;
