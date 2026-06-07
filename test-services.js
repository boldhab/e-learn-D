const { exec, spawn } = require('child_process');
const http = require('http');

const run = (cmd, cwd) => new Promise((resolve, reject) => {
  exec(cmd, { cwd }, (err, stdout, stderr) => {
    if (err) return reject(err);
    resolve();
  });
});

const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve({ status: res.statusCode, data }));
  }).on('error', reject);
});

async function main() {
  try {
    console.log('Installing dependencies for course-service...');
    await run('npm.cmd install', 'course-service');
    console.log('Installing dependencies for learning-service...');
    await run('npm.cmd install', 'learning-service');
    console.log('Dependencies installed.');
    
    console.log('Starting services...');
    const auth = spawn('node', ['server.js'], { cwd: 'auth-service' });
    const course = spawn('node', ['server.js'], { cwd: 'course-service' });
    const learning = spawn('node', ['server.js'], { cwd: 'learning-service' });
    
    // wait for them to start
    await new Promise(r => setTimeout(r, 8000));
    
    console.log('Checking health endpoints...');
    
    try {
      const authHealth = await get('http://localhost:5001/health');
      console.log('✅ Auth Service:', authHealth.data);
    } catch(e) { console.log('❌ Auth Service failed:', e.message); }
    
    try {
      const courseHealth = await get('http://localhost:5002/health');
      console.log('✅ Course Service:', courseHealth.data);
    } catch(e) { console.log('❌ Course Service failed:', e.message); }
    
    try {
      const learningHealth = await get('http://localhost:5003/health');
      console.log('✅ Learning Service:', learningHealth.data);
    } catch(e) { console.log('❌ Learning Service failed:', e.message); }
    
    auth.kill();
    course.kill();
    learning.kill();
    console.log('✅ Done testing services.');
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
