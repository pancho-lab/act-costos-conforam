#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { OdooLibraryClient } from '../src/lib/odoo-library';

dotenv.config({ path: '.env.local' });

async function testLibraryClient() {
  console.log('🔄 Testing OdooLibraryClient (using odoo-xmlrpc package)...\n');

  try {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    const client = new OdooLibraryClient(config);

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
    const categories = await client.getCategories(5);
    console.log(`✅ Found ${categories.length} categories`);
    
    if (categories.length > 0) {
      console.log('Categories data:');
      categories.forEach(cat => {
        console.log(`  - [${cat.id}] ${cat.name} ${cat.parent_name ? `(parent: ${cat.parent_name})` : ''}`);
      });
    } else {
      console.log('⚠️ No categories returned');
    }
    console.log();

    // Test products read
    console.log('3. Testing products read...');
    const products = await client.getProducts([], 3);
    console.log(`✅ Found ${products.length} products`);
    
    if (products.length > 0) {
      console.log('Products data:');
      products.forEach(prod => {
        console.log(`  - [${prod.id}] ${prod.name} (${prod.default_code || 'No code'}) - $${prod.standard_price}`);
        console.log(`    Category: ${prod.categ_name || prod.categ_id}`);
      });
    } else {
      console.log('⚠️ No products returned');
    }
    console.log();

    if (categories.length > 0 && products.length > 0) {
      console.log('🎉 SUCCESS! Odoo connection working with library!');
    } else {
      console.log('❌ Library still has issues');
    }

  } catch (error) {
    console.error('❌ Library test failed:', error);
    process.exit(1);
  }
}

testLibraryClient();