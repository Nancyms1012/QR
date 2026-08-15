/**
 * Script to seed the KV namespace with participant data.
 * 
 * Usage:
 *   1. First create a KV namespace in Cloudflare:
 *      wrangler kv:namespace create CHECKIN_KV
 *   
 *   2. Then run this script with the namespace ID:
 *      node scripts/seed-kv.js
 * 
 *   Or manually with wrangler:
 *      wrangler kv:key put --namespace-id=YOUR_ID "participants" "$(cat data/participants.json)"
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'participants.json');
const data = fs.readFileSync(DATA_FILE, 'utf8');

// Validate JSON
const participants = JSON.parse(data);
console.log(`📋 Loaded ${participants.length} participants`);
console.log('');
console.log('To seed your KV namespace, run:');
console.log('');
console.log(`  npx wrangler kv:key put --binding=CHECKIN_KV "participants" '${data.replace(/'/g, "'\\''")}'`);
console.log('');
console.log('Or if you know your namespace ID:');
console.log('');
console.log(`  npx wrangler kv:key put --namespace-id=YOUR_NAMESPACE_ID "participants" '${data.replace(/'/g, "'\\''")}'`);
console.log('');
console.log('✅ Copy and run the command above in your terminal.');
