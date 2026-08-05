-- ============================================================================
-- ONE-OFF DATA FIX — NOT PART OF THE DRIZZLE MIGRATION JOURNAL.
-- This file was moved out of backend/drizzle/ because it is NOT listed in
-- backend/drizzle/meta/_journal.json, so `db:migrate` never runs it, and it is
-- destructive + NON-IDEMPOTENT (running it twice shifts times by 14 hours).
-- Run manually at most once, only if the timezone bugfix has not yet been
-- applied to production. Do NOT re-add it to the journal.
-- ============================================================================
-- Perbaiki data attendance yang tersimpan dengan bug timezone.
-- Old code menyimpan jam WIB (09:39) seolah-olah UTC, sehingga TIMESTAMP
-- tersimpan 7 jam lebih maju. Contoh:
--   Absen 09:39 WIB → dulu tersimpan 09:39 UTC (salah)
--   Sekarang harus → 02:39 UTC (= 09:39 WIB)
--
-- Cara pakai: jalankan SEgera setelah restart backend & SEBELUM ada absen baru.

UPDATE attendances
SET
  checkin_time  = DATE_SUB(checkin_time, INTERVAL 7 HOUR),
  checkout_time = IF(checkout_time IS NOT NULL, DATE_SUB(checkout_time, INTERVAL 7 HOUR), NULL);

UPDATE teacher_attendances
SET
  checkin_time  = DATE_SUB(checkin_time, INTERVAL 7 HOUR),
  checkout_time = IF(checkout_time IS NOT NULL, DATE_SUB(checkout_time, INTERVAL 7 HOUR), NULL);
