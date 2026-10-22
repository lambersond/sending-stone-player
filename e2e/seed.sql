-- The e2e's starting data, loaded by reset-db.sh after the app's migrations, before every run. All of it
-- synthetic, and only what the suites expect to find (everything else they make themselves):
-- - Alice (e2e-user, "Alice Adventurer"), who runs the suites' campaigns and plays in them, and Bob
--   (e2e-bob), a second player, with one session each. The suites sign their session cookies for these
--   tokens with the pass's secret (env.mjs: cookieFor('e2e-token'), cookieFor('e2e-bob-token')); each
--   session lasts 7 days from the reset.
-- - Two campaigns of the Lonely Mountain game from before Gamemasters set campaigns up here, with no
--   owner and no secret: "The Lonely Mountain" (the module's camp-a) and "Shadows of Mirkwood"
--   (camp-b). gm-e2e sets them up again and binds them, and finds Alice already playing their Thorin
--   Oakenshield and Vex, from before invites; theme-e2e opens that Thorin, who has no sheet.
insert into "user" (id, name, email, "createdAt", "updatedAt") values
  ('e2e-user', 'Alice Adventurer', 'alice@example.test', now(), now()),
  ('e2e-bob', 'Bob', 'bob@example.test', now(), now());

insert into "session" (id, token, "userId", "expiresAt", "createdAt", "updatedAt") values
  ('e2e-session-alice', 'e2e-token', 'e2e-user', now() + interval '7 days', now(), now()),
  ('e2e-session-bob', 'e2e-bob-token', 'e2e-bob', now() + interval '7 days', now(), now());

insert into "campaign" (id, origin, "foundryId", title, characters, "lastEventAt", "lastSeenAt", "createdAt", "updatedAt") values
  ('seedlonelymountain', 'https://lonely-mountain.forge-vtt.com', 'camp-a', 'The Lonely Mountain',
   '[{"id": "thorin", "name": "Thorin Oakenshield"}]', now() - interval '30 days', now() - interval '30 days',
   now() - interval '30 days', now() - interval '30 days'),
  ('seedmirkwood', 'https://lonely-mountain.forge-vtt.com', 'camp-b', 'Shadows of Mirkwood',
   '[{"id": "vex", "name": "Vex"}, {"id": "bard", "name": "Bard the Bowman"}]', now() - interval '30 days', now() - interval '30 days',
   now() - interval '30 days', now() - interval '30 days');

insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "createdAt", "updatedAt") values
  ('seedthorin', 'Thorin Oakenshield', 'https://lonely-mountain.forge-vtt.com', 'The Lonely Mountain', 'seedlonelymountain', 'thorin', 'e2e-user',
   now() - interval '30 days', now() - interval '30 days'),
  ('seedvex', 'Vex', 'https://lonely-mountain.forge-vtt.com', 'Shadows of Mirkwood', 'seedmirkwood', 'vex', 'e2e-user',
   now() - interval '30 days', now() - interval '30 days');
