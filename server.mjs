import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const port = process.env.PORT || 3000;
const dataDirectory = join(process.cwd(), 'data');
const historyFile = join(dataDirectory, 'quest-history.json');

const allowedBands = ['6-8', '9-12', '13-17', '18-21'];
const allowedGoals = ['greetings', 'feelings', 'boundaries', 'asking-for-help', 'conversation', 'reading'];

const fallbackQuests = {
  '6-8': { title: 'The Lost Library Card', skill: 'asking for help', scenario: 'Nova cannot find the library card. The librarian is nearby.', question: 'What could Nova say?', choices: ['“Excuse me, can you help me find my card?”', 'Grab the librarian’s sleeve', '“You need to find it now!”'], correctIndex: 0, hint: 'A polite greeting and a clear question can help.', feedback: 'Nice job asking clearly and kindly.' },
  '9-12': { title: 'A New Team Game', skill: 'conversation', scenario: 'A group is playing a new game at break. You would like to join them.', question: 'What is one clear way to begin?', choices: ['“Hi, can you tell me how to play?”', '“This game looks boring.”', 'Take the game pieces without asking'], correctIndex: 0, hint: 'You can show interest and ask a question.', feedback: 'You chose a friendly way to join in.' },
  '13-17': { title: 'The Group Project', skill: 'boundaries', scenario: 'Your classmates are planning a project in a fast, noisy chat. You are finding it hard to follow.', question: 'What could you say?', choices: ['“Could we slow down or write the tasks in one message? I want to help.”', '“Stop being annoying.”', 'Agree to work you do not understand'], correctIndex: 0, hint: 'Self-advocacy can be clear and respectful.', feedback: 'That is a practical way to ask for what you need.' },
  '18-21': { title: 'First Shift Questions', skill: 'asking for help', scenario: 'At a new work placement, you are unsure where completed forms should go.', question: 'What is a professional next step?', choices: ['“Hi, could you show me where I should put completed forms?”', 'Put them somewhere random', 'Leave without asking'], correctIndex: 0, hint: 'It is okay to ask for clarification at work.', feedback: 'You chose a clear and responsible question.' }
};

function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(body)); }
function cleanProfile(value = {}) {
  const ageBand = allowedBands.includes(value.ageBand) ? value.ageBand : '9-12';
  const goal = allowedGoals.includes(value.goal) ? value.goal : 'conversation';
  return { ageBand, goal, learnerId: String(value.learnerId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'demo' };
}
async function getHistory() { try { return JSON.parse(await readFile(historyFile, 'utf8')); } catch { return []; } }
async function saveQuest(profile, quest) { const history = await getHistory(); history.push({ learnerId: profile.learnerId, ageBand: profile.ageBand, goal: profile.goal, title: quest.title, scenario: quest.scenario, savedAt: new Date().toISOString().slice(0, 10) }); await mkdir(dataDirectory, { recursive: true }); await writeFile(historyFile, JSON.stringify(history.slice(-500), null, 2)); }

async function generateQuest(profile, previous) {
  if (!process.env.OPENAI_API_KEY) return { ...fallbackQuests[profile.ageBand], generatedBy: 'reviewed-fallback' };
  const previousTopics = previous.map(x => `${x.title}: ${x.scenario}`).join('\n').slice(-3500) || 'None yet.';
  const instructions = `You create one calm, inclusive daily learning quest for City of Connections. It supports neurodivergent learners and learners with disabilities; do not diagnose, shame, infantilize, force eye contact, or imply one social style is correct. Teach options, consent, boundaries, and self-advocacy. Create a fresh situation unlike the history. Do not mention therapy, mental-health diagnoses, violence, romance, drugs, crime, or emergencies. Avoid time pressure and competition. Use concrete language suited to the requested age band. Exactly one choice must be the best respectful option. The best choice may include asking for a break, clarification, support, or space. Keep each field concise.`;
  const schema = { type: 'object', additionalProperties: false, required: ['title','skill','scenario','question','choices','correctIndex','hint','feedback'], properties: { title: { type: 'string' }, skill: { type: 'string' }, scenario: { type: 'string' }, question: { type: 'string' }, choices: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } }, correctIndex: { type: 'integer', minimum: 0, maximum: 2 }, hint: { type: 'string' }, feedback: { type: 'string' } } };
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: 'gpt-5', store: false, max_output_tokens: 450, instructions, input: `Age band: ${profile.ageBand}\nAdult-selected learning goal: ${profile.goal}\nPrior quest history for this learner (do not repeat these):\n${previousTopics}`, text: { format: { type: 'json_schema', name: 'daily_quest', strict: true, schema } } }) });
  if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
  const payload = await response.json();
  const quest = JSON.parse(payload.output_text);
  return { ...quest, generatedBy: 'ai' };
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || req.url !== '/api/daily-quest') return send(res, 404, { error: 'Use POST /api/daily-quest' });
  let raw = ''; for await (const part of req) raw += part; if (raw.length > 10_000) return send(res, 413, { error: 'Request too large' });
  try { const profile = cleanProfile(JSON.parse(raw || '{}')); const history = (await getHistory()).filter(x => x.learnerId === profile.learnerId).slice(-30); const quest = await generateQuest(profile, history); await saveQuest(profile, quest); send(res, 200, quest); }
  catch (error) { console.error(error); send(res, 500, { error: 'Could not prepare a quest. Please use a reviewed fallback quest.' }); }
}).listen(port, () => console.log(`Daily quest server on http://localhost:${port}`));
