const { generateMatchIntro } = require('./generate-match-intro');

// After creating a match pair
const intro = await generateMatchIntro(member1, member2);

if (intro.success) {
  console.log(`Generated intro in ${intro.language}:`);
  console.log(intro.data.one_liner);
  console.log(intro.data.conversation_starters);
  
  // Store in Airtable Match record or use directly in notification
} else {
  console.error('Intro generation failed, sending match without intro');
}