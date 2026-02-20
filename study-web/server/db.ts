import { Database } from 'bun:sqlite';

const dbPath = process.env.DB_PATH || 'study.db';
const db = new Database(dbPath, { create: true });

// Initialize DB
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    data TEXT -- JSON string of the course object
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS user_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    task_id TEXT,
    code TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, task_id)
  );
`);

// Seed Data
import { MOCK_COURSES } from './mockData';

const getUserAttempt = db.query(
    'SELECT * FROM user_attempts WHERE user_id = $userId AND task_id = $taskId',
);
const upsertUserAttempt = db.query(`
    INSERT INTO user_attempts (user_id, task_id, code)
    VALUES ($userId, $taskId, $code)
    ON CONFLICT(user_id, task_id) DO UPDATE SET code = excluded.code
`);

const getCourses = db.query('SELECT * FROM courses');
const insertCourse = db.query(
    'INSERT OR IGNORE INTO courses (id, data) VALUES ($id, $data)',
);

// Seed if empty
if (getCourses.all().length === 0) {
    console.log('Seeding database...');
    for (const course of MOCK_COURSES) {
        insertCourse.run({ $id: course.id, $data: JSON.stringify(course) });
    }
}

export { db, getCourses, getUserAttempt, upsertUserAttempt };
