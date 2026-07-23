-- Create a PostgreSQL sequence for atomic invoice number generation
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1 NO MAXVALUE NO CACHE;
