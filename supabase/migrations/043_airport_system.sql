CREATE TABLE IF NOT EXISTS platform_airports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country_code VARCHAR(5) DEFAULT 'AU',
  google_place_id VARCHAR(255),
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_airport_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  platform_airport_id UUID REFERENCES platform_airports(id),
  parking_fee DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, platform_airport_id)
);

INSERT INTO platform_airports (name, city, google_place_id, keywords)
VALUES
  ('Sydney Airport', 'Sydney', 'ChIJASFVO4muEmsRgRSKIr8AAAM', ARRAY['SYD','Sydney Airport','T1','T2','T3','Mascot','Kingsford Smith']),
  ('Melbourne Airport', 'Melbourne', 'ChIJlVyP4RJFD2sRkJaGqcXQGaA', ARRAY['MEL','Melbourne Airport','Tullamarine','Essendon']),
  ('Brisbane Airport', 'Brisbane', 'ChIJSWFbGg5XkWsRONMWotpQjCs', ARRAY['BNE','Brisbane Airport','Eagle Farm']),
  ('Perth Airport', 'Perth', 'ChIJA18FThWqMioRSJBBOHgJdMA', ARRAY['PER','Perth Airport']),
  ('Adelaide Airport', 'Adelaide', 'ChIJqWrGiPVvD2sRmocSX_6UAAU', ARRAY['ADL','Adelaide Airport']),
  ('Gold Coast Airport', 'Gold Coast', 'ChIJa2uldAAWkWsRMOWBotpQjCs', ARRAY['OOL','Gold Coast Airport','Coolangatta'])
ON CONFLICT DO NOTHING;
