CREATE TABLE `academic_years` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_years_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` varchar(255),
	`refresh_token` varchar(255),
	`id_token` varchar(2048),
	`expires_at` timestamp,
	`password` varchar(255),
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agenda_attendances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agenda_id` int NOT NULL,
	`student_id` int NOT NULL,
	`status` enum('PRESENT','SICK','EXCUSED','ABSENT','DISPEN') NOT NULL DEFAULT 'ABSENT',
	`checkin_time` timestamp,
	`notes` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agenda_attendances_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_agenda_attendance` UNIQUE(`agenda_id`,`student_id`)
);
--> statement-breakpoint
CREATE TABLE `attendances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`class_id` int,
	`academic_year_id` int NOT NULL,
	`semester_id` int NOT NULL,
	`attendance_date` date NOT NULL,
	`status` enum('PRESENT','LATE','SICK','EXCUSED','ABSENT') NOT NULL,
	`is_verified` boolean NOT NULL DEFAULT false,
	`checkin_time` timestamp,
	`checkin_photo` varchar(255),
	`checkin_latitude` double,
	`checkin_longitude` double,
	`checkout_time` timestamp,
	`checkout_photo` varchar(255),
	`checkout_latitude` double,
	`checkout_longitude` double,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day_name` varchar(20) NOT NULL,
	`checkin_start` time NOT NULL,
	`late_after` time NOT NULL,
	`checkout_time` time NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `schedules_day_name_unique` UNIQUE(`day_name`)
);
--> statement-breakpoint
CREATE TABLE `semesters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`academic_year_id` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `semesters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	`ip_address` varchar(45),
	`user_agent` varchar(255),
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nis` varchar(50) NOT NULL,
	`class_id` int NOT NULL,
	`device_uuid` varchar(255),
	`qrcode` varchar(255),
	`face_embedding` text,
	`photo` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_nis_unique` UNIQUE(`nis`)
);
--> statement-breakpoint
CREATE TABLE `subject_attendances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teaching_schedule_id` int NOT NULL,
	`student_id` int NOT NULL,
	`attendance_date` date NOT NULL,
	`status` enum('PRESENT','SICK','EXCUSED','ABSENT','DISPEN','SKIPPED') NOT NULL,
	`notes` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subject_attendances_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_subject_attendance` UNIQUE(`teaching_schedule_id`,`student_id`,`attendance_date`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `subjects_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `teacher_agendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`class_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`agenda_type` varchar(50),
	`subject` varchar(100),
	`date` date NOT NULL,
	`start_time` time,
	`end_time` time,
	`academic_year_id` int NOT NULL,
	`semester_id` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_agendas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teaching_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacher_id` varchar(36) NOT NULL,
	`class_id` int NOT NULL,
	`day_name` varchar(20) NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`subject` varchar(100),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teaching_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teaching_session_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teaching_schedule_id` int NOT NULL,
	`attendance_date` date NOT NULL,
	`materi` varchar(500),
	`kegiatan` varchar(500),
	`catatan_kendala` text,
	`foto_pembelajaran` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teaching_session_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_teaching_session` UNIQUE(`teaching_schedule_id`,`attendance_date`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL,
	`image` varchar(255),
	`role` varchar(50) NOT NULL DEFAULT 'siswa',
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp,
	`updated_at` timestamp,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agenda_attendances` ADD CONSTRAINT `agenda_attendances_agenda_id_teacher_agendas_id_fk` FOREIGN KEY (`agenda_id`) REFERENCES `teacher_agendas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agenda_attendances` ADD CONSTRAINT `agenda_attendances_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_semester_id_semesters_id_fk` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `semesters` ADD CONSTRAINT `semesters_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subject_attendances` ADD CONSTRAINT `sa_tsched_fk` FOREIGN KEY (`teaching_schedule_id`) REFERENCES `teaching_schedules`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subject_attendances` ADD CONSTRAINT `subject_attendances_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_agendas` ADD CONSTRAINT `teacher_agendas_teacher_id_user_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_agendas` ADD CONSTRAINT `teacher_agendas_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_agendas` ADD CONSTRAINT `teacher_agendas_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_agendas` ADD CONSTRAINT `teacher_agendas_semester_id_semesters_id_fk` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teaching_schedules` ADD CONSTRAINT `teaching_schedules_teacher_id_user_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teaching_schedules` ADD CONSTRAINT `teaching_schedules_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teaching_session_logs` ADD CONSTRAINT `tsl_tsched_fk` FOREIGN KEY (`teaching_schedule_id`) REFERENCES `teaching_schedules`(`id`) ON DELETE no action ON UPDATE no action;