'use server';

import axios from "axios";
import FormData from "form-data";

export async function generateCardIdea(type: string, userPrompt?: string) {
  // 1. Construct Metadata Manually
  // Prompt: "Skull King Card Game: You will need to generate the following image for a [type]: [userPrompt]"
  const visual_prompt = `Skull King Card Game: You will need to generate the following image for a ${type}: ${userPrompt || 'fantasy theme, pirate style, detailed, 8k'}`;

  const metadata = {
    name: `New ${type}`,
    description: userPrompt || `A custom ${type} card.`,
    visual_prompt: visual_prompt
  };

  // 2. Generate Image using Stability AI API (Direct)
  let imageUrl = null;
  try {
    console.log("Generating image with prompt:", metadata.visual_prompt);

    const payload = {
      prompt: metadata.visual_prompt,
      output_format: "jpeg"
    };

    const formData = new FormData();
    formData.append("prompt", payload.prompt);
    formData.append("output_format", payload.output_format);

    // Note: The axios call in Next.js Server Actions might need distinct handling for FormData headers
    // But using form-data package usually works fine in Node environment.
    const response = await axios.post(
      `https://api.stability.ai/v2beta/stable-image/generate/sd3`,
      formData,
      {
        responseType: "arraybuffer", // Important for receiving binary image data
        headers: {
          Authorization: `Bearer ${process.env.STABILITYAI_API_KEY}`,
          Accept: "image/*",
          ...formData.getHeaders()
        },
        validateStatus: undefined // Allow handling status codes manually
      },
    );

    if (response.status === 200) {
      const buffer = Buffer.from(response.data);
      imageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } else {
      console.error(`Stability API Error: ${response.status}`, response.data.toString());
      throw new Error(`${response.status}: ${response.data.toString()}`);
    }

  } catch (e: any) {
    console.error("Image generation failed:", e.message || e);
    if (e.response && e.response.data) {
      // Try to read buffer if it's an arraybuffer response
      try {
        const errText = Buffer.from(e.response.data).toString();
        console.error("API Error Data:", errText);
      } catch (inner) {
        console.error("API Error Data (raw):", e.response.data);
      }
    }
  }

  return {
    ...metadata,
    imageUrl: imageUrl
  };
}
