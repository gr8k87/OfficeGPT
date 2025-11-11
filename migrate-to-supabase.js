
const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting migration to Supabase...\n');
    
    // Read backup data
    const users = JSON.parse(fs.readFileSync('backup_users.json', 'utf8'));
    const conversations = JSON.parse(fs.readFileSync('backup_conversations.json', 'utf8'));
    const messages = JSON.parse(fs.readFileSync('backup_messages.json', 'utf8'));
    
    console.log(`📊 Data to migrate:`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Conversations: ${conversations.length}`);
    console.log(`   Messages: ${messages.length}\n`);
    
    // Import users
    console.log('Importing users...');
    for (const user of users) {
      await pool.query(
        'INSERT INTO officegpt_users (id, username, password) VALUES ($1, $2, $3)',
        [user.id, user.username, user.password]
      );
    }
    console.log(`✓ Imported ${users.length} users\n`);
    
    // Import conversations
    console.log('Importing conversations...');
    for (const conv of conversations) {
      await pool.query(
        'INSERT INTO officegpt_conversations (id, title, user_id, model, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [conv.id, conv.title, conv.user_id, conv.model, conv.created_at, conv.updated_at]
      );
    }
    console.log(`✓ Imported ${conversations.length} conversations\n`);
    
    // Import messages
    console.log('Importing messages...');
    for (const msg of messages) {
      await pool.query(
        'INSERT INTO officegpt_messages (id, conversation_id, role, content, model, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [msg.id, msg.conversation_id, msg.role, msg.content, msg.model, msg.created_at]
      );
    }
    console.log(`✓ Imported ${messages.length} messages\n`);
    
    // Update sequences to continue from max ID
    await pool.query(`SELECT setval('officegpt_users_id_seq', (SELECT MAX(id) FROM officegpt_users))`);
    await pool.query(`SELECT setval('officegpt_conversations_id_seq', (SELECT MAX(id) FROM officegpt_conversations))`);
    await pool.query(`SELECT setval('officegpt_messages_id_seq', (SELECT MAX(id) FROM officegpt_messages))`);
    console.log('✓ Updated sequence counters\n');
    
    // Verify counts
    const userCount = await pool.query('SELECT COUNT(*) FROM officegpt_users');
    const convCount = await pool.query('SELECT COUNT(*) FROM officegpt_conversations');
    const msgCount = await pool.query('SELECT COUNT(*) FROM officegpt_messages');
    
    console.log('📊 Verification:');
    console.log(`   Users: ${userCount.rows[0].count} (expected: ${users.length})`);
    console.log(`   Conversations: ${convCount.rows[0].count} (expected: ${conversations.length})`);
    console.log(`   Messages: ${msgCount.rows[0].count} (expected: ${messages.length})\n`);
    
    if (userCount.rows[0].count == users.length && 
        convCount.rows[0].count == conversations.length && 
        msgCount.rows[0].count == messages.length) {
      console.log('✅ Migration completed successfully!');
      console.log('You can now delete the backup files: backup_*.json and migrate-to-supabase.js');
    } else {
      console.error('❌ Count mismatch! Please verify data manually.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
