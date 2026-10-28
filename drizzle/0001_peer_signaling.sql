CREATE TABLE mp_signals (seq INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, sender TEXT NOT NULL, target TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX mp_signals_target ON mp_signals(target, seq);
--> statement-breakpoint
CREATE INDEX mp_signals_created ON mp_signals(created);
