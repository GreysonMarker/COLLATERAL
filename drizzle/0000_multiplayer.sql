CREATE TABLE mp_rooms (code TEXT PRIMARY KEY, created INTEGER NOT NULL, epoch INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE mp_players (id TEXT PRIMARY KEY, room TEXT NOT NULL, token TEXT NOT NULL, name TEXT NOT NULL, seen INTEGER NOT NULL, state TEXT NOT NULL DEFAULT '{}');
--> statement-breakpoint
CREATE INDEX mp_players_room ON mp_players(room, seen);
--> statement-breakpoint
CREATE TABLE mp_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, sender TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX mp_events_room ON mp_events(room, seq);
