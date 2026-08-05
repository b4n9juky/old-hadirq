ALTER TABLE `attendances` ADD `checkin_accuracy` double;--> statement-breakpoint
ALTER TABLE `students` ADD `parent_id` varchar(36);--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_parent_id_user_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;