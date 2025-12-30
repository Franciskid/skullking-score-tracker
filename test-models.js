
const { GoogleGenAI } = require("@google/genai");

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        console.error("Please set GEMINI_API_KEY env var");
        return;
    }

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
        console.log("Fetching models...");
        // The SDK structure might be client.models.list() or similar depending on version
        // Based on recent docs it's often under 'models'
        const response = await client.models.list();
        console.log("Response Keys:", Object.keys(response));
        const models = response.models || response; // Try to handle if it's nested

        if (!Array.isArray(models)) {
            console.log("Raw Response:", response);
            return;
        }


        console.log("Available Models:");
        for (const m of models) {
            console.log(`- ${m.name}`);
            if (m.supportedGenerationMethods) {
                console.log(`  Methods: ${m.supportedGenerationMethods.join(', ')}`);
            }
        }

    } catch (e) {
        console.error("Error listing models:", e);
        if (e.response) {
            console.log("Response:", e.response);
        }
    }
}

main();
