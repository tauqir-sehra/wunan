// Points the API at the test database before any module reads its settings.
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.PHOTOS_DIR = process.env.PHOTOS_DIR_TEST ?? './photos-test';
// Device-notification keys used only by the tests (a fresh pair, not used anywhere else).
process.env.VAPID_PUBLIC_KEY = 'BCqW4uR_wB7SZCVZ_9zzRJqI3_9-z424hVlLZvkW2xcOi_i-GQpnxl_pmV5wJxMrt3IDVUtvm_y0sO36t_VrlZc';
process.env.VAPID_PRIVATE_KEY = 'aunHLGGAk5OXa9xzRJjf6zAY4qB4gZzfryFCb51kUI4';
process.env.VAPID_SUBJECT = 'mailto:tests@example.org';
// Place suggestions are off unless a test starts the stub (src/test/places-stub.ts) and points
// config.PLACES_URL at it, so no test ever reaches the internet.
process.env.PLACES_URL = '';
