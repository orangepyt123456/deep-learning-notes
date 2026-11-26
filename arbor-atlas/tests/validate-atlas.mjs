import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const nodes = read('data/nodes.json');
const links = read('data/relationships.json');
const review = read('data/research-review.json');
const domainIds = new Set([
  'learning', 'architectures', 'training', 'generative', 'language', 'vision', 'agents', 'embodied',
]);
const types = new Set(['模型', '方法', '智能体', '闭环系统', '基准', '实验']);
const today = new Date().toISOString().slice(0, 10);
const currentYear = Number(today.slice(0, 4));
const text = value => typeof value === 'string' && value.trim().length > 0;
const validDate = value =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value &&
  value <= today;
const https = value => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

assert(Array.isArray(nodes) && nodes.length > 0, 'nodes.json must be non-empty');
const ids = new Set(nodes.map(n => n.id));
assert.equal(ids.size, nodes.length, 'Node IDs must be unique');

for (const n of nodes) {
  assert(text(n.id), 'Missing node ID');
  assert(domainIds.has(n.domain), n.id + ': invalid primary domain');
  assert(Number.isInteger(n.year) && n.year >= 1900 && n.year <= currentYear, n.id + ': year outside range');
  for (const field of [
    'short', 'title', 'authors', 'summary', 'summaryEn', 'retained', 'retainedEn',
    'caveat', 'caveatEn', 'scoreReason', 'scoreReasonEn',
  ]) assert(text(n[field]), n.id + ': missing ' + field);
  assert(types.has(n.type), n.id + ': invalid research type');
  assert(Array.isArray(n.keywords) && n.keywords.length > 0, n.id + ': missing keywords');
  for (const key of ['representativeness', 'method', 'evidence']) {
    assert(Number.isFinite(n.scores[key]) && n.scores[key] >= 1 && n.scores[key] <= 5, n.id + ': invalid score');
  }
  assert(n.source && text(String(n.source.reference)), n.id + ': missing source citation');
  assert(['survey', 'research'].includes(n.source.origin || 'survey'), n.id + ': invalid provenance');
  if (n.source.origin === 'research') {
    assert(validDate(n.source.checkedAt), n.id + ': missing research check date');
    assert(n.source.sources?.length > 0, n.id + ': missing primary sources');
    assert(['journal', 'conference', 'preprint', 'project'].includes(n.source.publicationType), n.id + ': missing publication type');
  }
  if (n.source.sources) {
    for (const src of n.source.sources) assert(https(src.url) && text(src.title), n.id + ': invalid primary source');
  }
  assert(https(n.url), n.id + ': missing https url');
}

const edgeKeys = new Set();
for (const e of links) {
  assert(ids.has(e.source) && ids.has(e.target), 'Unknown relationship endpoint');
  assert.equal(e.type, 'thematic', 'Only thematic links are accepted');
  assert(text(e.label) && text(e.labelEn) && text(e.reason) && text(e.reasonEn), 'Relationship text required');
  const key = [e.source, e.target].sort().join('|');
  assert(!edgeKeys.has(key), 'Duplicate relationship: ' + key);
  edgeKeys.add(key);
}

assert(validDate(review.checkedAt), 'Invalid review date');
assert.equal(review.scope.totalNodes, nodes.length, 'Review count mismatch');
assert.equal(review.scope.relationships, links.length, 'Relationship count mismatch');
assert.equal(review.scope.domains, domainIds.size, 'Domain count mismatch');
for (const d of domainIds) {
  const count = nodes.filter(n => n.domain === d).length;
  assert(count > 0, 'No nodes for ' + d);
  assert.equal(review.scope.domainCounts[d], count, 'Domain count mismatch for ' + d);
  assert(review.findings.some(f => f.domain === d && text(f.zh) && text(f.en)), 'Missing finding: ' + d);
}

console.log(
  JSON.stringify({
    validated: true,
    nodes: nodes.length,
    domains: domainIds.size,
    relationships: links.length,
    years: [Math.min(...nodes.map(n => n.year)), Math.max(...nodes.map(n => n.year))],
  })
);