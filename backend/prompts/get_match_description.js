const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Determine output language from shared languages
const getMatchLanguage = (member1, member2) => {
  const langs1 = member1.Languages || ['English'];
  const langs2 = member2.Languages || ['English'];
  const shared = langs1.filter(l => langs2.includes(l));

  // Prefer Russian if both speak it, otherwise English
  if (shared.includes('Russian')) return 'Russian';
  return 'English';
};

const generateMatchIntros = async (member1, member2, matchReason = "") => {
  const language = getMatchLanguage(member1, member2);

  let contextInjection = "";
  if (matchReason) {
    contextInjection = `\n\nCORE MATCH REASON (Use this to frame the connection): "${matchReason}"`;
  }

  const systemPrompt = `You are a warm, insightful matchmaker for Linked.Coffee — a random coffee platform for tech professionals. 
  ${contextInjection}

Your job: Write TWO personalized introductions — one for each person — explaining why meeting the other person could be interesting FOR THEM specifically. Also identify what they share in common.

Tone: Warm and personal. Address each person directly by name. Write as if you're a friend saying "Hey, I found someone great for you to meet."

Language: Write your entire response in ${language}.

Style examples:
- BAD: "Вы оба цените удалёнку" (third person)
- GOOD: "Вас объединяет любовь к удалёнке и осознанный подход к work-life balance" (about their connection)
- BAD for intro: "Кристина фокусируется на развитии людей" (describing them)
- GOOD for intro: "Алексей, тебе будет интересно поговорить с Кристиной — она строит HR-процессы в распределённых командах"

Output format — respond with valid JSON only, no markdown:
{
  "shared_ground": "1-2 sentences about what connects these two people — shared interests, similar paths, common challenges. Use 'вас обоих/вас объединяет' or 'you both'. This will be shown to BOTH people.",
  "for_member1": {
    "greeting": "One sentence that greets ${member1.Name} AND briefly introduces ${member2.Name} with their role/profession. Example: '${member1.Name}, познакомься с ${member2.Name} — [role] из [location], который [interesting detail].'",
    "why_interesting": "2-3 sentences on why meeting ${member2.Name} is valuable for them specifically",
    "conversation_starters": ["question 1", "question 2"]
  },
  "for_member2": {
    "greeting": "One sentence that greets ${member2.Name} AND briefly introduces ${member1.Name} with their role/profession. Example: '${member2.Name}, познакомься с ${member1.Name} — [role] из [location], который [interesting detail].'",
    "why_interesting": "2-3 sentences on why meeting ${member1.Name} is valuable for them specifically",
    "conversation_starters": ["question 1", "question 2"]
  }
}

Rules:
- shared_ground: Focus on genuine overlap — interests, experience level, goals, location, challenges
- If a 'CORE MATCH REASON' is provided, you MUST trust it and build your narrative around it.
- Each personal intro must feel written specifically for that person
- Focus on what the OTHER person can offer THEM
- Reference specific details from profiles — profession, interests, goals
- Conversation starters should be things THIS person would want to ask the other
- Never invent facts not in the profiles
- Keep shared_ground under 50 words, each personal intro under 100 words
- All text must be in ${language}`;

  const userPrompt = `Generate personalized match introductions for these two people:

**Person 1 (${member1.Name}):**
- Profession: ${member1.Profession || 'Not specified'}
- Grade: ${member1.Grade || 'Not specified'}
- Professional interests: ${member1.Professional_Interests?.join(', ') || 'Not specified'}
- Personal interests: ${member1.Personal_Interests?.join(', ') || 'Not specified'}
- Professional bio: ${member1.Professional_Description || 'Not provided'}
- Personal bio: ${member1.Personal_Description || 'Not provided'}
- Location: ${member1.City || 'Unknown'}, ${member1.Country || 'Unknown'}
- Goals: ${member1.Coffee_Goals?.join(', ') || 'Casual Chat'}

**Person 2 (${member2.Name}):**
- Profession: ${member2.Profession || 'Not specified'}
- Grade: ${member2.Grade || 'Not specified'}
- Professional interests: ${member2.Professional_Interests?.join(', ') || 'Not specified'}
- Personal interests: ${member2.Personal_Interests?.join(', ') || 'Not specified'}
- Professional bio: ${member2.Professional_Description || 'Not provided'}
- Personal bio: ${member2.Personal_Description || 'Not provided'}
- Location: ${member2.City || 'Unknown'}, ${member2.Country || 'Unknown'}
- Goals: ${member2.Coffee_Goals?.join(', ') || 'Casual Chat'}

Remember: Write for_member1 as a message TO ${member1.Name} about why meeting ${member2.Name} is interesting.
Write for_member2 as a message TO ${member2.Name} about why meeting ${member1.Name} is interesting.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });

    let content = response.content[0].text.trim();

    // Sanitize: Remove markdown code blocks if present
    if (content.startsWith('```')) {
      content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const result = JSON.parse(content);

    return {
      success: true,
      language,
      sharedCombined: result.shared_ground, // Return global shared context
      introFor: {
        [member1.Tg_ID]: result.for_member1,
        [member2.Tg_ID]: result.for_member2
      }
    };
  } catch (error) {
    console.error('Failed to generate match intros:', error.message);
    return {
      success: false,
      language,
      error: error.message
    };
  }
};

module.exports = { generateMatchIntros };