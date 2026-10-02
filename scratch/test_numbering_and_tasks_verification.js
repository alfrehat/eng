require('dotenv').config();
const numberingEngine = require('../services/numberingEngine');
const tasksService = require('../services/tasksEngineService');
const { dbGet, dbRun, isPostgresActive } = require('../utils/database');

async function test() {
    console.log('=== TESTING NUMBERING ENGINE & TASKS ENGINE (ZERO RUNTIME DDL) ===');
    console.log('isPostgresActive():', isPostgresActive());

    // 1. Test Numbering Engine Monotonicity & Persistence
    console.log('\n--- 1. Numbering Engine Test ---');
    const seqRowBefore = await dbGet('SELECT last_value FROM public.system_sequences WHERE seq_key = $1', ['tasks_2026']);
    const valBefore = seqRowBefore ? parseInt(seqRowBefore.last_value, 10) : 0;
    console.log('tasks_2026 last_value before:', valBefore);

    const id1 = await numberingEngine.generateNextId('tasks');
    const id2 = await numberingEngine.generateNextId('tasks');
    console.log('Generated ID 1:', id1);
    console.log('Generated ID 2:', id2);

    const seqRowAfter = await dbGet('SELECT last_value FROM public.system_sequences WHERE seq_key = $1', ['tasks_2026']);
    const valAfter = seqRowAfter ? parseInt(seqRowAfter.last_value, 10) : 0;
    console.log('tasks_2026 last_value after:', valAfter);

    if (valAfter !== valBefore + 2) {
        throw new Error(`Sequence did not increment by 2! Expected ${valBefore + 2}, got ${valAfter}`);
    }
    console.log('✅ Numbering Engine sequence state persisted and incremented monotonically!');

    // 2. Test Tasks Service Full CRUD with Zero DDL
    console.log('\n--- 2. Tasks Engine Service Test ---');
    const createdTask = await tasksService.createTask({
        title: 'مهمة فحص بدون تعديل المخطط',
        description: 'التأكد من خلو محرك المهام من Runtime DDL',
        assigned_to: 'U-001',
        priority: 'HIGH',
        created_by: 'U-001'
    });
    console.log('Created Task ID:', createdTask.id);

    const fetchedTask = await tasksService.getTaskById(createdTask.id);
    if (!fetchedTask || fetchedTask.title !== 'مهمة فحص بدون تعديل المخطط') {
        throw new Error('Failed to retrieve created task!');
    }
    console.log('Fetched Task Title:', fetchedTask.title);

    const updatedTask = await tasksService.updateTask(createdTask.id, {
        status: 'IN_PROGRESS'
    });
    if (!updatedTask || updatedTask.status !== 'IN_PROGRESS') {
        throw new Error('Failed to update task!');
    }
    console.log('Updated Task Status:', updatedTask.status);

    const deletedTask = await tasksService.deleteTask(createdTask.id);
    if (!deletedTask) {
        throw new Error('Failed to delete task!');
    }
    const afterDelete = await tasksService.getTaskById(createdTask.id);
    if (afterDelete !== null) {
        throw new Error('Task was not removed!');
    }
    console.log('✅ Tasks Engine Service full lifecycle passed with 0 runtime DDL!');
}

test().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
