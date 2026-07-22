const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const settings = await prisma.promptSettings.findUnique({
      where: { id: 'default' }
    });
    
    console.log('==================================================');
    console.log('🔍 PROMPT SETTINGS IN DATABASE:');
    console.log('==================================================');
    if (!settings) {
      console.log('⚠️ Record with id="default" not found in PromptSettings.');
    } else {
      console.log('ID:', settings.id);
      console.log('Has OpenRouter Key:', Boolean(settings.openRouterKey && settings.openRouterKey.trim().length > 0));
      console.log('Key Preview:', settings.openRouterKey ? (settings.openRouterKey.substring(0, 10) + '... (length: ' + settings.openRouterKey.length + ')') : '(empty string)');
      console.log('Timer Duration:', settings.timerDuration);
      console.log('Auto Send Transcription:', settings.autoSendTranscription);
      console.log('Hide Text Prompt:', settings.hideTextPrompt);
      console.log('Updated At:', settings.updatedAt);
    }
    console.log('==================================================');
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
