const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Instagram Verified Comments Scraper...');

// Check if Node.js is installed
try {
  const nodeVersion = execSync('node -v').toString().trim();
  console.log(`Node.js version: ${nodeVersion}`);
} catch (error) {
  console.error('Node.js is not installed. Please install Node.js before continuing.');
  process.exit(1);
}

// Check if npm is installed
try {
  const npmVersion = execSync('npm -v').toString().trim();
  console.log(`npm version: ${npmVersion}`);
} catch (error) {
  console.error('npm is not installed. Please install npm before continuing.');
  process.exit(1);
}

// Install dependencies
console.log('Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('Dependencies installed successfully!');
} catch (error) {
  console.error('Failed to install dependencies:', error.message);
  process.exit(1);
}

console.log('\nSetup completed successfully!');
console.log('\nTo start the application, run:');
console.log('npm start');
console.log('\nThen open your browser and navigate to:');
console.log('http://localhost:3000'); 