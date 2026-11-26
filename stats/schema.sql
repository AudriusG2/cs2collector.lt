-- Kiek unikalių lankytojų ir peržiūrų per dieną (Lietuvos laiku)
CREATE TABLE IF NOT EXISTS days (
  day TEXT PRIMARY KEY,
  uniques INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0
);
-- Šiandienos lankytojų anoniminiai ID (kad tas pats žmogus būtų skaičiuojamas vieną kartą).
-- Laikomi tik 2 dienas, paskui ištrinami.
CREATE TABLE IF NOT EXISTS visitors (
  day TEXT NOT NULL,
  id TEXT NOT NULL,
  PRIMARY KEY (day, id)
);
