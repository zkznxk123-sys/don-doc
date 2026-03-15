-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('CFO', 'MEMBER', 'VIEWER')) DEFAULT 'MEMBER',
  family_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 가족 테이블
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 거래 내역 테이블
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount BIGINT NOT NULL, -- 원 단위 (정수)
  description TEXT NOT NULL,
  vendor VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('SHARED', 'PRIVATE')) DEFAULT 'PRIVATE',
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 자산 테이블
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  value BIGINT NOT NULL, -- 원 단위 (정수)
  allocation DECIMAL(5,2) NOT NULL, -- 백분율
  change BIGINT DEFAULT 0, -- 변동액
  change_percent DECIMAL(5,2) DEFAULT 0, -- 변동율
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_family_id ON users(family_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_family_id ON transactions(family_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_visibility ON transactions(visibility);
CREATE INDEX idx_assets_family_id ON assets(family_id);

-- RLS (Row Level Security) 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- RLS 정책
-- 사용자는 자신의 정보만 볼 수 있음
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- 가족 구성원은 같은 가족의 다른 구성원 정보를 볼 수 있음
CREATE POLICY "Family members can view each other" ON users
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- 가족 구성원은 같은 가족의 거래 내역을 볼 수 있음 (단, visibility 적용)
CREATE POLICY "Family members can view family transactions" ON transactions
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- 가족 구성원은 거래를 생성할 수 있음
CREATE POLICY "Family members can create transactions" ON transactions
  FOR INSERT WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    ) AND
    user_id = auth.uid()
  );

-- 본인 거래 또는 CFO는 거래를 수정할 수 있음
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (
    user_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'CFO' AND family_id = transactions.family_id
    )
  );

-- 가족 구성원은 같은 가족의 자산 정보를 볼 수 있음
CREATE POLICY "Family members can view family assets" ON assets
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- 함수: updatedAt 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거: updatedAt 자동 업데이트
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
