import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/mysql2';
import { users } from './drizzle/schema';

const db = drizzle(process.env.DATABASE_URL!);

async function createAdmin() {
  console.log('🔐 Criando usuário admin...');
  
  const username = 'David12#';
  const password = 'David12';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    await db.insert(users).values({
      username,
      password: hashedPassword,
      name: 'David',
      loginMethod: 'password',
      role: 'admin',
    });
    
    console.log('✅ Usuário admin criado com sucesso!');
    console.log('   Usuário:', username);
    console.log('   Senha:', password);
    console.log('   Role: admin');
  } catch (error: any) {
    if (error.message?.includes('Duplicate entry')) {
      console.log('⚠️  Usuário já existe');
    } else {
      console.error('❌ Erro ao criar usuário:', error.message);
    }
  }
  
  process.exit(0);
}

createAdmin();
