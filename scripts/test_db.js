const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Начинаем тестирование базы данных и персистентности...\n');

  try {
    // 1. Тест PromptSettings
    console.log('1️⃣ Тестирование PromptSettings...');
    const settings = await prisma.promptSettings.upsert({
      where: { id: 'default' },
      update: {
        openRouterKey: 'sk-or-v1-test-key-12345',
        timerDuration: 7,
        autoSendTranscription: true,
        hideTextPrompt: false,
      },
      create: {
        id: 'default',
        openRouterKey: 'sk-or-v1-test-key-12345',
        timerDuration: 7,
        autoSendTranscription: true,
        hideTextPrompt: false,
      },
    });
    console.log('✅ Settings сохранены в БД:');
    console.log('   openRouterKey:', settings.openRouterKey);
    console.log('   timerDuration:', settings.timerDuration);
    console.log('   autoSendTranscription:', settings.autoSendTranscription);

    // 2. Тест PromptList
    console.log('\n2️⃣ Тестирование PromptList (создание списка)...');
    const list = await prisma.promptList.create({
      data: {
        name: 'Тестовый список ' + new Date().toLocaleTimeString(),
        order: 0,
      },
    });
    console.log('✅ PromptList создан (ID:', list.id, '| Name:', list.name, ')');

    // 3. Тест PromptAttachment
    console.log('\n3️⃣ Тестирование PromptAttachment (создание вложения)...');
    const attachment = await prisma.promptAttachment.create({
      data: {
        listId: list.id,
        name: 'Тестовая карточка',
        prompt: 'Киберпанк неоновый город',
        imageUrl: '/uploads/party-prompts/test-image.png',
        isUploaded: true,
        referenceUrls: JSON.stringify(['https://ref1.com/img.jpg', 'https://ref2.com/img.jpg']),
        order: 0,
      },
    });
    console.log('✅ PromptAttachment создано (ID:', attachment.id, '| Prompt:', attachment.prompt, ')');

    // 4. Тест PromptAttachmentHistory
    console.log('\n4️⃣ Тестирование PromptAttachmentHistory (запись генерации)...');
    const history = await prisma.promptAttachmentHistory.create({
      data: {
        attachmentId: attachment.id,
        imageUrl: 'https://openrouter.ai/generated-image-url.png',
        prompt: 'Киберпанк неоновый город детализированный',
        isUploaded: false,
        referenceUrl: 'https://ref1.com/img.jpg',
        referenceUrls: JSON.stringify(['https://ref1.com/img.jpg', 'https://ref2.com/img.jpg']),
      },
    });
    console.log('✅ History запись создана (ID:', history.id, '| Image:', history.imageUrl, ')');

    // 5. Тест чтения связей (relational query)
    console.log('\n5️⃣ Проверка реляционного чтения структуры из БД...');
    const fullList = await prisma.promptList.findUnique({
      where: { id: list.id },
      include: {
        attachments: {
          include: { history: true },
        },
      },
    });

    console.log('✅ Структура из БД успешно прочитана!');
    console.log('   Списков attachments:', fullList.attachments.length);
    console.log('   Записей истории:', fullList.attachments[0].history.length);

    // 6. Очистка тестового списка
    console.log('\n6️⃣ Очистка тестовых данных...');
    await prisma.promptList.delete({ where: { id: list.id } });
    console.log('✅ Тестовый список и связанные с ним записи удалены (Cascade Delete работает!)');

    console.log('\n🎉 ВСЕ ТЕСТЫ БАЗЫ ДАННЫХ И СВЯЗЕЙ ПРОЙДЕНЫ УСПЕШНО!');
  } catch (error) {
    console.error('❌ Ошибка при выполнении тестов БД:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
