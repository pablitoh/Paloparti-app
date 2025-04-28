import bcrypt from 'bcryptjs';

async function testBcrypt() {
  const password = 'test123';

  console.log('Original password:', password);

  // Hash the password
  console.log('Hashing password...');
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('Hashed password:', hashedPassword);

  // Compare with correct password
  console.log('\nComparing with correct password...');
  const isValid1 = await bcrypt.compare(password, hashedPassword);
  console.log('Result with correct password:', isValid1);

  // Compare with incorrect password
  console.log('\nComparing with incorrect password...');
  const isValid2 = await bcrypt.compare('wrongpassword', hashedPassword);
  console.log('Result with incorrect password:', isValid2);
}

testBcrypt().catch(console.error);
