import type { OdooCategory, OdooProduct } from '@/types';

// @ts-ignore - odoo-xmlrpc doesn't have types
const Odoo = require('odoo-xmlrpc');

export interface OdooConfig {
  url: string;
  db: string;
  user: string;
  apiKey: string;
}

export class OdooLibraryClient {
  private odoo: any;
  private uid: number | null = null;
  
  constructor(private config: OdooConfig) {
    this.odoo = new Odoo({
      url: config.url,
      db: config.db,
      username: config.user,
      password: config.apiKey // Using API key as password
    });
  }

  async auth(): Promise<number> {
    if (this.uid) return this.uid;
    
    return new Promise((resolve, reject) => {
      console.log('🔐 Authenticating with Odoo using library...');
      this.odoo.connect((err: any) => {
        if (err) {
          console.error('❌ Odoo library auth failed:', err);
          reject(new Error(`Authentication failed: ${err.message || err}`));
          return;
        }
        
        this.uid = this.odoo.uid;
        console.log(`✅ Library authenticated! UID: ${this.uid}`);
        resolve(this.uid);
      });
    });
  }

  async searchRead(model: string, domain: any[] = [], fields: string[] = [], options: any = {}): Promise<any[]> {
    await this.auth();
    
    return new Promise((resolve, reject) => {
      console.log(`🔍 Library searching ${model}...`);
      console.log('Domain:', domain);
      console.log('Fields:', fields);
      console.log('Options:', options);
      
      const searchOptions = {
        fields: fields.length > 0 ? fields : [],
        limit: options.limit || 10,
        offset: options.offset || 0,
        order: options.order || 'id asc'
      };
      
      this.odoo.execute_kw(model, 'search_read', [domain], searchOptions, (err: any, result: any) => {
        if (err) {
          console.error(`❌ Library search_read error for ${model}:`, err);
          reject(new Error(`Search failed: ${err.message || err}`));
          return;
        }
        
        console.log(`✅ Library found ${Array.isArray(result) ? result.length : 0} records`);
        console.log('First result:', result[0]);
        resolve(Array.isArray(result) ? result : []);
      });
    });
  }

  async getCategories(limit: number = 10): Promise<OdooCategory[]> {
    console.log(`📂 Getting ${limit} categories with library...`);
    const result = await this.searchRead('product.category', [], ['id', 'name', 'parent_id'], { limit, order: 'name asc' });
    
    return result.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      parent_id: Array.isArray(cat.parent_id) ? cat.parent_id[0] : cat.parent_id,
      parent_name: Array.isArray(cat.parent_id) ? cat.parent_id[1] : null
    }));
  }

  async getProducts(domain: any[] = [], limit: number = 5): Promise<OdooProduct[]> {
    console.log(`📦 Getting ${limit} products with library...`);
    const baseDomain = [['active', '=', true]];
    const finalDomain = domain.length > 0 ? [...baseDomain, ...domain] : baseDomain;
    const result = await this.searchRead('product.template', finalDomain, ['id', 'name', 'default_code', 'categ_id', 'standard_price'], { limit, order: 'name asc' });
    
    return result.map((prod: any) => ({
      id: prod.id,
      name: prod.name,
      default_code: prod.default_code || null,
      categ_id: Array.isArray(prod.categ_id) ? prod.categ_id[0] : prod.categ_id,
      categ_name: Array.isArray(prod.categ_id) ? prod.categ_id[1] : null,
      standard_price: prod.standard_price || 0,
      active: true
    }));
  }

  async testConnection(): Promise<{ success: boolean; uid?: number; error?: string }> {
    try {
      const uid = await this.auth();
      return { success: true, uid };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Factory singleton
let odooClient: OdooLibraryClient | null = null;

export function getOdooClient(): OdooLibraryClient {
  if (!odooClient) {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    if (!config.url || !config.db || !config.user || !config.apiKey) {
      throw new Error('Missing required Odoo configuration. Check ODOO_URL, ODOO_DB, ODOO_USER, and ODOO_API_KEY environment variables.');
    }

    odooClient = new OdooLibraryClient(config);
  }
  return odooClient;
}