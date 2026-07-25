// Run this with: npm run create-admin
// It asks for a username + password and prints the lines you should
// paste into your .env file.

const readline = require('readline');
const { hashPassword } = require('./auth');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('--- Create Admin Credentials ---');

rl.question('Enter admin username: ', (username) => {
  rl.question('Enter admin password: ', (password) => {
    const hash = hashPassword(password);
    console.log('\nAdd these lines to your .env file:\n');
    console.log(`ADMIN_USERNAME=${username}`);
    console.log(`ADMIN_PASSWORD_HASH=${hash}`);
    console.log('\nThen restart the server.\n');
    rl.close();
  });
});
