-- 021_crm_contacts_passengers.sql

-- =====================
-- 1. Contacts table
-- =====================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  company_name VARCHAR(200),
  customer_type VARCHAR(20) DEFAULT 'INDIVIDUAL' CHECK (customer_type IN ('INDIVIDUAL', 'CORPORATE')),

  payment_type VARCHAR(20) DEFAULT 'PREPAID' CHECK (payment_type IN ('PREPAID', 'MONTHLY_ACCOUNT')),
  credit_limit DECIMAL(10,2) DEFAULT 0,
  payment_terms VARCHAR(20) DEFAULT 'NET_7' CHECK (payment_terms IN ('NET_7', 'NET_14', 'NET_30')),
  current_balance DECIMAL(10,2) DEFAULT 0,

  discount_p2p DECIMAL(5,2) DEFAULT 0,
  discount_charter DECIMAL(5,2) DEFAULT 0,
  discount_airport DECIMAL(5,2) DEFAULT 0,

  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  internal_notes TEXT,

  total_bookings INT DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  last_booking_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 2. Passengers table
-- =====================
CREATE TABLE IF NOT EXISTS passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  company_name VARCHAR(200),

  preferred_temperature VARCHAR(50),
  preferred_music VARCHAR(100),
  preferred_language VARCHAR(50),
  allergies TEXT,
  special_requirements TEXT,
  notes TEXT,

  total_rides INT DEFAULT 0,
  last_ride_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 3. Booking links
-- =====================
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS passenger_id UUID REFERENCES passengers(id) ON DELETE SET NULL;

-- =====================
-- 4. Indexes
-- =====================
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_passengers_tenant ON passengers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_passengers_phone ON passengers(tenant_id, phone);
