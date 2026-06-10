import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const required = [
  'cv.md',
  'config/profile.yml',
  'config/domestic-portals.example.json',
  'config/level-mapping.cn.example.yml',
  'config/tracker-backends.example.json',
  'data/applications.md',
  'data/contacts.md',
  'data/followups.md',
  'data/interviews.md',
  'data/offers.md',
  'data/failure-reviews.md',
  'data/growth-radar.md',
  'interview-prep/story-bank.md',
  'modes/_shared.md',
  'modes/evaluate.md',
  'modes/resume.md',
  'modes/message.md',
  'modes/interview.md',
  'modes/tracker.md',
  'modes/coach.md',
  'modes/growth.md',
  'modes/story-sync.md',
  'modes/inbox.md',
  'modes/research.md',
  'modes/auto-pipeline.md',
  'modes/parse-jd.md',
  'templates/states.yml',
  'templates/growth-kit-template.md'
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

const result = {
  ok: missing.length === 0,
  onboardingNeeded: missing.includes('cv.md') || missing.includes('config/profile.yml'),
  missing
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) process.exitCode = 1;
