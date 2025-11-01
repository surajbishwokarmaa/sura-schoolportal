-- Remove the phone column from students table since we're only using parent_phone now
ALTER TABLE students DROP COLUMN IF EXISTS phone;