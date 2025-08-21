#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { OdooClient } from '../src/lib/odoo';

dotenv.config({ path: '.env.local' });

async function quickDebug() {
  const config = {
    url: process.env.ODOO_URL!,
    db: process.env.ODOO_DB!,
    user: process.env.ODOO_USER!,
    apiKey: process.env.ODOO_API_KEY!,
  };

  const client = new OdooClient(config);
  
  try {
    console.log('Testing categories...');
    const categories = await client.getCategories();
    console.log('Categories:', JSON.stringify(categories, null, 2));
    console.log('First category keys:', categories[0] ? Object.keys(categories[0]) : 'No categories');
    
    console.log('\nTesting products...');
    const products = await client.getProducts(undefined, { limit: 2 });
    console.log('Products:', JSON.stringify(products, null, 2));
    console.log('First product keys:', products[0] ? Object.keys(products[0]) : 'No products');
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

quickDebug();