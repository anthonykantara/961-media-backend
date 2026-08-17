const { GoogleGenerativeAI } = require('@google/generative-ai');
const secretsManager = require('./secretsManager');

/**
 * Generates 5 distinct headline angles for a topic and category.
 * @param {string} topic
 * @param {string} category
 * @returns {Promise<string[]>} List of 5 headline strings
 */
async function generateHeadlines(topic, category) {
  const apiKey = await secretsManager.getGeminiApiKey();

  const isMockKey = !apiKey || apiKey === 'mock-gemini-key' || apiKey.startsWith('mock') || process.env.NODE_ENV === 'test';

  if (!isMockKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              headlines: {
                type: 'array',
                items: { type: 'string' },
                minItems: 5,
                maxItems: 5
              }
            },
            required: ['headlines']
          }
        }
      });

      const prompt = `Generate 5 distinct, highly engaging headline angles for a media article in category "${category}" on the topic: "${topic}".`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text);
      if (parsed.headlines && Array.isArray(parsed.headlines) && parsed.headlines.length >= 5) {
        return parsed.headlines.slice(0, 5);
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to structured generator:', err.message);
    }
  }

  // Fallback / mock headline generator
  return [
    `Breaking: How ${topic} is Revolutionizing ${category} in 2026`,
    `5 Essential Insights Every ${category} Expert Needs to Know About ${topic}`,
    `The Unseen Future of ${topic}: What It Means for ${category}`,
    `Opinion: Why ${topic} is the Most Crucial Development in ${category} Today`,
    `Deep Dive: A Comprehensive Guide to ${topic} in ${category}`
  ];
}

/**
 * Generates structured article body, social summary, IG caption, and carousel slides.
 * @param {string} topic
 * @param {string} category
 * @param {string} chosenHeadline
 * @returns {Promise<{ article_body: string, social_summary: string, ig_caption: string, carousel_slides: Array }>}
 */
async function generateDraftContent(topic, category, chosenHeadline) {
  const apiKey = await secretsManager.getGeminiApiKey();

  const isMockKey = !apiKey || apiKey === 'mock-gemini-key' || apiKey.startsWith('mock') || process.env.NODE_ENV === 'test';

  if (!isMockKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              article_body: { type: 'string' },
              social_summary: { type: 'string' },
              ig_caption: { type: 'string' },
              carousel_slides: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    slide_number: { type: 'integer' },
                    title: { type: 'string' },
                    content: { type: 'string' }
                  },
                  required: ['slide_number', 'title', 'content']
                }
              }
            },
            required: ['article_body', 'social_summary', 'ig_caption', 'carousel_slides']
          }
        }
      });

      const prompt = `Write a comprehensive article and social media package based on:
Headline: "${chosenHeadline}"
Category: "${category}"
Topic: "${topic}"

Provide:
1. Full article body with detailed paragraphs.
2. Concise social summary for news feeds.
3. Engaging Instagram caption with relevant hashtags.
4. An array of 5 carousel slides, each with slide_number, title, and content.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text);
      if (parsed.article_body && parsed.social_summary && parsed.ig_caption && Array.isArray(parsed.carousel_slides)) {
        return parsed;
      }
    } catch (err) {
      console.warn('Gemini draft generation failed, falling back to structured generator:', err.message);
    }
  }

  // Structured output fallback generator
  return {
    article_body: `In recent developments surrounding ${topic}, industry leaders in ${category} have noted significant shifts. "${chosenHeadline}" highlights a key moment in this evolution. As technology and audience expectations advance, understanding ${topic} becomes essential for maintaining market innovation and reader engagement.`,
    social_summary: `Key updates on ${topic} in ${category}: Everything you need to know about "${chosenHeadline}".`,
    ig_caption: `🚨 BIG NEWS IN ${category.toUpperCase()}! 🚨\n\n${chosenHeadline}\n\nSwipe through to get the key takeaways on ${topic}. 📲👇\n\n#${category.replace(/\s+/g, '')} #${topic.replace(/\s+/g, '')} #961Media #BreakingNews`,
    carousel_slides: [
      { slide_number: 1, title: chosenHeadline, content: `Understanding the impact of ${topic} in ${category}.` },
      { slide_number: 2, title: 'Key Drivers', content: `What is behind the recent growth and interest in ${topic}?` },
      { slide_number: 3, title: 'Market Impact', content: `How ${category} stakeholders are adapting to this change.` },
      { slide_number: 4, title: 'Future Outlook', content: `What to expect next as ${topic} continues to unfold.` },
      { slide_number: 5, title: 'Takeaways', content: 'Follow 961 Media for real-time coverage and updates.' }
    ]
  };
}

module.exports = {
  generateHeadlines,
  generateDraftContent
};
