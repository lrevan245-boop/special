# Daily Quest AI Server

This is the safe server-side starting point for a new daily quest. It never puts the API key in the browser and accepts only a non-identifying learner ID, an age band, and an adult-selected goal.

## Run locally

1. Install Node.js 18 or later.
2. In this folder, set an environment variable named `OPENAI_API_KEY` to an OpenAI API key. Do not put a key into `index.html` or commit it to source control.
3. Run `npm start`.
4. Send a `POST` request to `http://localhost:3000/api/daily-quest`:

```json
{"learnerId":"demo-014","ageBand":"9-12","goal":"conversation"}
```

The valid age bands are `6-8`, `9-12`, `13-17`, and `18-21`. Adult-selected goals are `greetings`, `feelings`, `boundaries`, `asking-for-help`, `conversation`, and `reading`.

## Before use with learners

- Have a psychologist/special-education professional review the prompt, sample quests, and age-band language.
- Add authentication before hosting; the demo does not include accounts.
- Use a database rather than the small local history file for a hosted product.
- Do not send names, diagnoses, school names, or detailed personal history to the generator.
- Add a human-review queue for younger learners or high-stakes content.

The OpenAI Responses API supports server-side instructions, structured JSON-schema output, a `store: false` setting, and a hashed non-identifying safety identifier if you later add one. See the [official Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).
