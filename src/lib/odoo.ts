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
    
    // Parse simple integer responses (like UID)
    if (xml.includes('<int>')) {
      const match = xml.match(/<int>(\d+)<\/int>/);
      return match ? parseInt(match[1]) : null;
    }
    
    // Parse boolean responses
    if (xml.includes('<boolean>')) {
      const match = xml.match(/<boolean>([01])<\/boolean>/);
      return match ? match[1] === '1' : false;
    }

    // Parse array responses (simplified)
    if (xml.includes('<array>')) {
      try {
        // This is a simplified parser - for production use a proper XML parser
        const arrayContent = xml.match(/<array><data>(.*?)<\/data><\/array>/s);
        if (arrayContent) {
          // For now, return the raw content for debugging
          return this.parseArrayContent(arrayContent[1]);
        }
      } catch (error) {
        console.warn('Array parsing failed, returning raw XML');
      }
    }

    // For complex responses, return raw for now
    return xml;
  }

  private parseArrayContent(content: string): any[] {
    // Very basic array parser - would need improvement for production
    const items: any[] = [];
    const valueRegex = /<value>(.*?)<\/value>/gs;
    let match;
    
    while ((match = valueRegex.exec(content)) !== null) {
      const valueContent = match[1];
      if (valueContent.includes('<struct>')) {
        items.push(this.parseStruct(valueContent));
      } else if (valueContent.includes('<string>')) {
        const stringMatch = valueContent.match(/<string>(.*?)<\/string>/);
        items.push(stringMatch ? stringMatch[1] : '');
      } else if (valueContent.includes('<int>')) {
        const intMatch = valueContent.match(/<int>(\d+)<\/int>/);
        items.push(intMatch ? parseInt(intMatch[1]) : 0);
      }
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
      
      if (value.includes('<string>')) {
        const stringMatch = value.match(/<string>(.*?)<\/string>/);
        result[name] = stringMatch ? stringMatch[1] : '';
      } else if (value.includes('<int>')) {
        const intMatch = value.match(/<int>(\d+)<\/int>/);
        result[name] = intMatch ? parseInt(intMatch[1]) : 0;
      } else if (value.includes('<array>')) {
        const arrayMatch = value.match(/<array><data>(.*?)<\/data><\/array>/s);
        result[name] = arrayMatch ? this.parseArrayContent(arrayMatch[1]) : [];
      }
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
        fields: fields.length > 0 ? fields : undefined,
        offset: options.offset || 0,
        limit: options.limit || 10, // Reduced for testing
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