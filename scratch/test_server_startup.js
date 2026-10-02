const http = require('http');

console.log('Testing server startup & dependency loading...');

// Load server
try {
  const app = require('../server');
  console.log('✅ Server module loaded without error!');

  // Check critical modules
  require('bcryptjs');
  require('cors');
  require('dotenv');
  require('express');
  require('jsonwebtoken');
  require('multer');
  require('pg');
  require('ws');
  console.log('✅ All 8 production dependencies loaded and initialized cleanly in Node environment!');
  process.exit(0);
} catch (err) {
  console.error('❌ Server startup failure:', err);
  process.exit(1);
}
