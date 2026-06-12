-- Migration: Thêm trường email và email_sent vào bảng Booking và Customer
-- Chạy lệnh này trực tiếp trên Supabase SQL Editor nếu prisma db push không chạy được

-- 1. Thêm cột email vào bảng Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- 2. Thêm cột email_sent vào bảng Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "email_sent" BOOLEAN NOT NULL DEFAULT false;

-- 3. Thêm cột email vào bảng Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- Xác nhận thay đổi
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('Booking', 'Customer')
  AND column_name IN ('email', 'email_sent')
ORDER BY table_name, column_name;
