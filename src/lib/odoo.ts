import fetch from 'node-fetch';
import type { OdooCategory, OdooProduct } from '@/types';

export interface OdooConfig {
  url: string;
  db: string;
  user: string;
  apiKey: string;
}

export class OdooClient {
  private uid: number | null = null;
  
  constructor(private config: OdooConfig) {}

  private async xmlrpcCall(endpoint: string, method: string, params: any[]): Promise<any> {
    const url = `${this.config.url}${endpoint}`;
    
    const xmlData = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>
    ${params.map(param => `<param><value>${this.valueToXml(param)}</value></param>`).join('')}
  </params>
</methodCall>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'User-Agent': 'Conforama-Costos-Client'
        },
        body: xmlData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      return this.parseXmlResponse(responseText);
    } catch (error) {
      console.error(`Odoo XMLRPC call failed:`, error);
      throw error;
    }
  }

  private valueToXml(value: any): string {
    if (typeof value === 'string') {
      return `<string>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`;
    } else if (typeof value === 'number') {
      return Number.isInteger(value) ? `<int>${value}</int>` : `<double>${value}</double>`;
    } else if (typeof value === 'boolean') {
      return `<boolean>${value ? '1' : '0'}</boolean>`;
    } else if (Array.isArray(value)) {
      return `<array><data>${value.map(v => `<value>${this.valueToXml(v)}</value>`).join('')}</data></array>`;
    } else if (typeof value === 'object' && value !== null) {
      const members = Object.entries(value).map(([k, v]) => 
        `<member><name>${k}</name><value>${this.valueToXml(v)}</value></member>`
      ).join('');
      return `<struct>${members}</struct>`;
    } else {
      return `<string>${String(value)}</string>`;
    }
  }

  private parseXmlResponse(xml: string): any {
    // Check for faults
    if (xml.includes('<fault>')) {
      const errorMatch = xml.match(/<string>([^<]+)<\/string>/);
      throw new Error(errorMatch ? errorMatch[1] : 'Odoo error');
    }
    
    // Extract the main response value - handle whitespace and newlines
    const responseMatch = xml.match(/<methodResponse>\s*<params>\s*<param>\s*<value>(.*?)<\/value>\s*<\/param>\s*<\/params>\s*<\/methodResponse>/s);
    if (!responseMatch) {
      console.error('Failed to parse XML response:', xml);
      throw new Error('Invalid XML response format');
    }
    
    return this.parseValue(responseMatch[1]);
  }

  private parseValue(content: string): any {
    // Parse different XML-RPC value types
    if (content.includes('<int>')) {
      const match = content.match(/<int>(-?\d+)<\/int>/);
      return match ? parseInt(match[1]) : 0;
    }
    
    if (content.includes('<double>')) {
      const match = content.match(/<double>(-?\d*\.?\d+)<\/double>/);
      return match ? parseFloat(match[1]) : 0;
    }
    
    if (content.includes('<string>')) {
      const match = content.match(/<string>(.*?)<\/string>/s);
      return match ? match[1] : '';
    }
    
    if (content.includes('<boolean>')) {
      const match = content.match(/<boolean>([01])<\/boolean>/);
      return match ? match[1] === '1' : false;
    }
    
    if (content.includes('<array>')) {
      const arrayMatch = content.match(/<array><data>(.*?)<\/data><\/array>/s);
      if (arrayMatch) {
        return this.parseArrayContent(arrayMatch[1]);
      }
      return [];
    }
    
    if (content.includes('<struct>')) {
      return this.parseStruct(content);
    }
    
    // If no specific type found, try to return as string
    return content.trim();
  }

  private parseArrayContent(content: string): any[] {
    const items: any[] = [];
    const valueRegex = /<value>(.*?)<\/value>/gs;
    let match;
    
    while ((match = valueRegex.exec(content)) !== null) {
      items.push(this.parseValue(match[1]));
    }
    
    return items;
  }

  private parseStruct(content: string): any {
    const result: any = {};
    const memberRegex = /<member><name>(.*?)<\/name><value>(.*?)<\/value><\/member>/gs;
    let match;
    
    while ((match = memberRegex.exec(content)) !== null) {
      const name = match[1];
      const value = match[2];
      result[name] = this.parseValue(value);
    }
    
    return result;
  }

  async auth(): Promise<number> {
    if (this.uid) return this.uid;
    
    try {
      const result = await this.xmlrpcCall(
        '/xmlrpc/2/common',
        'authenticate',
        [this.config.db, this.config.user, this.config.apiKey, {}]
      );
      
      if (typeof result === 'number' && result > 0) {
        this.uid = result;
        console.log(`Odoo authenticated successfully with UID: ${result}`);
        return result;
      } else {
        throw new Error('Invalid authentication response');
      }
    } catch (error) {
      console.error('Odoo auth error:', error);
      throw new Error(`Odoo auth failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchRead(
    model: string,
    domain: any[] = [],
    fields: string[] = [],
    options: { 
      offset?: number; 
      limit?: number; 
      order?: string;
      context?: Record<string, any>;
    } = {}
  ): Promise<any[]> {
    await this.auth();
    
    const params = [
      this.config.db,
      this.uid,
      this.config.apiKey,
      model,
      'search_read',
      [domain],
      {
        fields: fields.length > 0 ? fields : [],
        offset: options.offset || 0,
        limit: options.limit || 10,
        order: options.order || 'id asc',
        context: options.context || {}
      }
    ];

    try {
      const result = await this.xmlrpcCall('/xmlrpc/2/object', 'execute_kw', params);
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error(`Odoo searchRead error for ${model}:`, error);
      throw new Error(`Odoo searchRead failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async write(
    model: string,
    ids: number[],
    values: Record<string, any>,
    context: Record<string, any> = {}
  ): Promise<boolean> {
    await this.auth();
    
    const params = [
      this.config.db,
      this.uid,
      this.config.apiKey,
      model,
      'write',
      [ids, values],
      { context }
    ];

    try {
      const result = await this.xmlrpcCall('/xmlrpc/2/object', 'execute_kw', params);
      return typeof result === 'boolean' ? result : true;
    } catch (error) {
      console.error(`Odoo write error for ${model}:`, error);
      throw new Error(`Odoo write failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async call(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {},
    context: Record<string, any> = {}
  ): Promise<any> {
    await this.auth();
    
    const params = [
      this.config.db,
      this.uid,
      this.config.apiKey,
      model,
      method,
      args,
      { ...kwargs, context }
    ];

    try {
      const result = await this.xmlrpcCall('/xmlrpc/2/object', 'execute_kw', params);
      return result;
    } catch (error) {
      console.error(`Odoo call error for ${model}.${method}:`, error);
      throw new Error(`Odoo call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Método específico para cambio contable de costo estándar
  async changeStandardPrice(
    productIds: number[],
    newCost: number,
    companyId: number
  ): Promise<any> {
    return this.call(
      'product.template',
      'change_standard_price',
      [productIds, newCost],
      {},
      { company_id: companyId }
    );
  }

  // Métodos de conveniencia para el dominio del negocio
  async getCategories(companyId?: number): Promise<OdooCategory[]> {
    const context = companyId ? { company_id: companyId } : {};
    return this.searchRead(
      'product.category',
      [], // No domain filter for categories - they don't have active field
      ['id', 'name', 'parent_id'],
      { context, order: 'name asc', limit: 50 }
    );
  }

  async getProducts(
    companyId?: number,
    options: { offset?: number; limit?: number; domain?: any[] } = {}
  ): Promise<OdooProduct[]> {
    const baseDomain = [['active', '=', true]];
    const domain = options.domain ? [...baseDomain, ...options.domain] : baseDomain;
    const context = companyId ? { company_id: companyId } : {};
    
    return this.searchRead(
      'product.template',
      domain,
      ['id', 'name', 'default_code', 'categ_id', 'active', 'standard_price'],
      { 
        context,
        offset: options.offset,
        limit: options.limit || 5, // Limit for testing
        order: 'name asc'
      }
    );
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
let odooClient: OdooClient | null = null;

export function getOdooClient(): OdooClient {
  if (!odooClient) {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    // Validar configuración
    if (!config.url || !config.db || !config.user || !config.apiKey) {
      throw new Error('Missing required Odoo configuration. Check ODOO_URL, ODOO_DB, ODOO_USER, and ODOO_API_KEY environment variables.');
    }

    odooClient = new OdooClient(config);
  }
  return odooClient;
}