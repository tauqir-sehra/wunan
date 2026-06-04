// Points the API at the test database before any module reads its settings.
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.PHOTOS_DIR = process.env.PHOTOS_DIR_TEST ?? './photos-test';
