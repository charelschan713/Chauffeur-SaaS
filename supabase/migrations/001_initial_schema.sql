-- 开启UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- tenants表
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  domain VARCHAR(255),
  status VARCHAR(20) DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING','ACTIVE','SUSPENDED')),
  commission_rate DECIMAL(5,2) DEFAULT 20.00,
  subscription_plan VARCHAR(50) DEFAULT 'STARTER',
  subscription_status VARCHAR(20) DEFAULT 'TRIAL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- profiles表（对接Supabase auth.users）
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  role VARCHAR(30) NOT NULL 
    CHECK (role IN (
      'SUPER_ADMIN','TENANT_ADMIN','TENANT_STAFF',
      'CORPORATE_ADMIN','PASSENGER','DRIVER'
    )),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(30),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- drivers表
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  tenant_id UUID REFERENCES tenants(id),
  license_number VARCHAR(100),
  license_expiry DATE,
  status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACTIVE','INACTIVE','SUSPENDED')),
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_trips INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- vehicles表
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id),
  tenant_id UUID REFERENCES tenants(id),
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  color VARCHAR(50),
  plate_number VARCHAR(30),
  vehicle_class VARCHAR(20) 
    CHECK (vehicle_class IN ('BUSINESS','FIRST','VAN','ELECTRIC')),
  capacity INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- corporate_accounts表
CREATE TABLE corporate_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  company_name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(100),
  billing_email VARCHAR(255),
  billing_address TEXT,
  credit_limit DECIMAL(10,2) DEFAULT 0,
  current_balance DECIMAL(10,2) DEFAULT 0,
  payment_terms VARCHAR(20) DEFAULT 'PREPAID'
    CHECK (payment_terms IN ('PREPAID','NET15','NET30')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- bookings表
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  passenger_id UUID REFERENCES profiles(id),
  driver_id UUID REFERENCES drivers(id),
  corporate_account_id UUID REFERENCES corporate_accounts(id),
  pickup_address TEXT NOT NULL,
  pickup_lat DECIMAL(10,8),
  pickup_lng DECIMAL(11,8),
  dropoff_address TEXT NOT NULL,
  dropoff_lat DECIMAL(10,8),
  dropoff_lng DECIMAL(11,8),
  pickup_datetime TIMESTAMPTZ NOT NULL,
  vehicle_class VARCHAR(20),
  status VARCHAR(30) DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING','CONFIRMED','DRIVER_ASSIGNED',
      'IN_PROGRESS','COMPLETED','CANCELLED'
    )),
  passenger_count INTEGER DEFAULT 1,
  special_requests TEXT,
  flight_number VARCHAR(20),
  base_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- payments表
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  tenant_id UUID REFERENCES tenants(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(30)
    CHECK (payment_method IN ('CARD','CORPORATE_ACCOUNT','BANK_TRANSFER')),
  status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','CAPTURED','FAILED','REFUNDED')),
  stripe_payment_intent_id VARCHAR(255),
  platform_fee DECIMAL(10,2),
  tenant_payout DECIMAL(10,2),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- pricing_rules表
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  vehicle_class VARCHAR(20),
  base_fare DECIMAL(10,2) NOT NULL,
  price_per_km DECIMAL(10,2),
  price_per_minute DECIMAL(10,2),
  minimum_fare DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- notifications表
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  booking_id UUID REFERENCES bookings(id),
  type VARCHAR(10) CHECK (type IN ('EMAIL','SMS','PUSH')),
  template VARCHAR(100),
  status VARCHAR(20) DEFAULT 'PENDING',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 自动更新updated_at的函数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- 给每张有updated_at的表加触发器
CREATE TRIGGER trg_tenants BEFORE UPDATE ON tenants 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_drivers BEFORE UPDATE ON drivers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehicles BEFORE UPDATE ON vehicles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings BEFORE UPDATE ON bookings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pricing_rules BEFORE UPDATE ON pricing_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 开启所有表的RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- profiles：用户只能看自己，租户管理员能看本租户所有人
CREATE POLICY "self_read" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "tenant_admin_read" ON profiles
  FOR SELECT USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (auth.jwt()->>'role') IN ('TENANT_ADMIN','TENANT_STAFF')
  );

-- bookings：租户数据隔离
CREATE POLICY "tenant_bookings" ON bookings
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- passengers只能看自己的订单
CREATE POLICY "passenger_own_bookings" ON bookings
  FOR SELECT USING (passenger_id = auth.uid());

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  claims JSONB;
  user_profile RECORD;
BEGIN
  SELECT role, tenant_id INTO user_profile
  FROM profiles WHERE id = (event->>'user_id')::UUID;

  claims := event->'claims';
  claims := jsonb_set(claims, '{role}', to_jsonb(user_profile.role));
  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_profile.tenant_id::TEXT));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
