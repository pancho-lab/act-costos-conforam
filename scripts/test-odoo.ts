#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { OdooClient } from '../src/lib/odoo';

dotenv.config({ path: '.env.local' });

async function testOdooConnection() {
  console.log('🔄 Testing Odoo connection...\n');

  try {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    console.log('Configuration:');
    console.log(`- URL: ${config.url}`);
    console.log(`- Database: ${config.db}`);
    console.log(`- User: ${config.user}`);
    console.log(`- API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'NOT SET'}\n`);

    const client = new OdooClient(config);

    // Test authentication
    console.log('1. Testing authentication...');
    const result = await client.testConnection();
    
    if (!result.success) {
      console.error('❌ Authentication failed:', result.error);
      process.exit(1);
    }
    
    console.log(`✅ Authentication successful! UID: ${result.uid}\n`);

    // Test categories read
    console.log('2. Testing categories read...');
    const categories = await client.getCategories();
    console.log(`✅ Found ${categories.length} categories`);
    
    if (categories.length > 0) {
      console.log('Sample categories:');
      categories.slice(0, 3).forEach(cat => {
        console.log(`  - [${cat.id}] ${cat.name}`);
      });
    }
    console.log();

    // Test products read
    console.log('3. Testing products read...');
    const products = await client.getProducts(undefined, { limit: 5 });
    console.log(`✅ Found ${products.length} products (limited to 5)`);
    
    if (products.length > 0) {
      console.log('Sample products:');
      products.forEach(prod => {
        console.log(`  - [${prod.id}] ${prod.name} (${prod.default_code || 'No code'}) - $${prod.standard_price}`);
      });
    }
    console.log();

    console.log('🎉 All tests passed! Odoo integration is working correctly.');

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testOdooConnection();
}

export default testOdooConnection;