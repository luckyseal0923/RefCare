const fs = require('node:fs');
const path = require('node:path');

function nextVersion(previous, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const date = ['year', 'month', 'day'].map(type => parts.find(x => x.type === type).value).join('.');
  const match = /^(\d{4}\.\d{2}\.\d{2})-(\d{2,})$/.exec(previous || '');
  if (match && date < match[1]) throw new Error('Release date cannot go backwards');
  const sequence = match && match[1] === date ? Number(match[2]) + 1 : 1;
  return `${date}-${String(sequence).padStart(2, '0')}`;
}
if (require.main === module) {
  const file = path.join(__dirname, '..', 'release.json');
  const previous = JSON.parse(fs.readFileSync(file, 'utf8')).version;
  const version = nextVersion(previous);
  fs.writeFileSync(file, JSON.stringify({ version }, null, 2) + '\n');
  console.log(`Release: ${previous} -> ${version}. Commit release.json with the changes before publishing.`);
}
module.exports = { nextVersion };
