/**
 * JSON Toolbox - JSON Schema Generator
 * Auto-generates JSON Schema (Draft 2020-12) from sample JSON data.
 * @module schema_generator
 * @version 1.0.0
 */
(function () {
  'use strict';

  const Core = window.JSONToolsCore;

  /**
   * Default options for schema generation
   */
  const DEFAULT_OPTIONS = {
    addTitles: false,
    addDescriptions: false,
    markRequired: true,
    uniqueItems: false,
    detectFormats: true,
    schemaId: 'https://example.com/schema.json',
    schemaTitle: 'Generated Schema'
  };

  /**
   * Infer JSON Schema for a single value
   * @param {*} value - Value to analyze
   * @param {Object} options - Generation options
   * @param {string} [propertyName] - Name of the property (for titles)
   * @returns {Object} - JSON Schema
   */
  function inferSchemaForValue(value, options, propertyName = '') {
    const type = Core.inferType(value);
    const schema = {};

    switch (type) {
      case 'null':
        schema.type = 'null';
        break;
        
      case 'boolean':
        schema.type = 'boolean';
        break;
        
      case 'integer':
        schema.type = 'integer';
        break;
        
      case 'number':
        // Check if it could be integer
        if (Number.isInteger(value)) {
          schema.type = 'integer';
        } else {
          schema.type = 'number';
        }
        break;
        
      case 'string':
        schema.type = 'string';
        // Detect format
        if (options.detectFormats) {
          const format = Core.detectFormat(value);
          if (format) {
            schema.format = format;
          }
        }
        break;
        
      case 'array':
        schema.type = 'array';
        if (value.length > 0) {
          // Analyze array items
          const itemSchemas = value.map((item, i) => 
            inferSchemaForValue(item, options, `${propertyName}[${i}]`)
          );
          // Try to merge item schemas
          schema.items = mergeItemSchemas(itemSchemas, options);
        } else {
          schema.items = {};
        }
        if (options.uniqueItems) {
          schema.uniqueItems = true;
        }
        break;
        
      case 'object':
        schema.type = 'object';
        schema.properties = {};
        const required = [];
        
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            schema.properties[key] = inferSchemaForValue(
              value[key], 
              options, 
              key
            );
            if (options.markRequired) {
              required.push(key);
            }
          }
        }
        
        if (required.length > 0) {
          schema.required = required;
        }
        break;
        
      default:
        schema.type = 'string'; // Fallback
    }

    // Add title if enabled
    if (options.addTitles && propertyName) {
      schema.title = formatTitle(propertyName);
    }

    // Add description placeholder if enabled
    if (options.addDescriptions && propertyName) {
      schema.description = `Description for ${propertyName}`;
    }

    return schema;
  }

  /**
   * Merge multiple item schemas into a single schema
   * @param {Object[]} schemas - Array of schemas to merge
   * @param {Object} options - Generation options
   * @returns {Object} - Merged schema
   */
  function mergeItemSchemas(schemas, options) {
    if (schemas.length === 0) {
      return {};
    }

    if (schemas.length === 1) {
      return schemas[0];
    }

    // Check if all schemas have the same type
    const types = new Set(schemas.map(s => s.type));
    
    if (types.size === 1) {
      const type = schemas[0].type;
      
      if (type === 'object') {
        // Merge object schemas
        return mergeObjectSchemas(schemas, options);
      } else if (type === 'array') {
        // Merge nested array schemas
        const itemSchemas = schemas
          .filter(s => s.items)
          .map(s => s.items);
        const result = { type: 'array' };
        if (itemSchemas.length > 0) {
          result.items = mergeItemSchemas(itemSchemas, options);
        }
        return result;
      } else {
        // Primitive types - return first (they should be identical)
        return schemas[0];
      }
    } else {
      // Mixed types - use anyOf or fallback
      const uniqueSchemas = [];
      const seen = new Set();
      
      for (const schema of schemas) {
        const key = JSON.stringify(schema);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSchemas.push(schema);
        }
      }
      
      if (uniqueSchemas.length === 1) {
        return uniqueSchemas[0];
      }
      
      return { anyOf: uniqueSchemas };
    }
  }

  /**
   * Merge multiple object schemas
   * @param {Object[]} schemas - Array of object schemas
   * @param {Object} options - Generation options
   * @returns {Object} - Merged schema
   */
  function mergeObjectSchemas(schemas, options) {
    const result = {
      type: 'object',
      properties: {}
    };
    
    // Collect all properties and their schemas
    const propertySchemas = {};
    const propertyCounts = {};
    const totalSamples = schemas.length;
    
    for (const schema of schemas) {
      if (schema.properties) {
        for (const key in schema.properties) {
          if (!propertySchemas[key]) {
            propertySchemas[key] = [];
            propertyCounts[key] = 0;
          }
          propertySchemas[key].push(schema.properties[key]);
          propertyCounts[key]++;
        }
      }
    }
    
    // Merge each property's schemas
    for (const key in propertySchemas) {
      result.properties[key] = mergeItemSchemas(propertySchemas[key], options);
    }
    
    // Determine required fields (only if present in ALL samples)
    if (options.markRequired) {
      const required = [];
      for (const key in propertyCounts) {
        if (propertyCounts[key] === totalSamples) {
          required.push(key);
        }
      }
      if (required.length > 0) {
        result.required = required;
      }
    }
    
    return result;
  }

  /**
   * Format a property name as a title
   * @param {string} name - Property name
   * @returns {string} - Formatted title
   */
  function formatTitle(name) {
    // Remove array indices
    name = name.replace(/\[\d+\]/g, '');
    // Convert camelCase to Title Case
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  /**
   * Generate JSON Schema from a single sample
   * @param {*} sample - Sample JSON data
   * @param {Object} [options] - Generation options
   * @returns {Object} - JSON Schema
   */
  function inferSchema(sample, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: opts.schemaId
    };
    
    if (opts.schemaTitle) {
      schema.title = opts.schemaTitle;
    }
    
    // Generate schema for the sample
    const contentSchema = inferSchemaForValue(sample, opts, '');
    
    // Merge content schema into main schema
    Object.assign(schema, contentSchema);
    
    return schema;
  }

  /**
   * Generate JSON Schema from multiple samples
   * @param {Array} samples - Array of sample JSON objects
   * @param {Object} [options] - Generation options
   * @returns {Object} - JSON Schema
   */
  function inferSchemaFromSamples(samples, options = {}) {
    if (!Array.isArray(samples) || samples.length === 0) {
      throw new Error('At least one sample is required');
    }
    
    if (samples.length === 1) {
      return inferSchema(samples[0], options);
    }
    
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Generate schema for each sample
    const individualSchemas = samples.map(sample => 
      inferSchemaForValue(sample, opts, '')
    );
    
    // Merge all schemas
    const mergedContent = mergeItemSchemas(individualSchemas, opts);
    
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: opts.schemaId
    };
    
    if (opts.schemaTitle) {
      schema.title = opts.schemaTitle;
    }
    
    Object.assign(schema, mergedContent);
    
    return schema;
  }

  /**
   * Merge two existing schemas
   * @param {Object} schema1 - First schema
   * @param {Object} schema2 - Second schema
   * @param {Object} [options] - Merge options
   * @returns {Object} - Merged schema
   */
  function mergeSchemas(schema1, schema2, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Strip meta properties for merging
    const content1 = { ...schema1 };
    const content2 = { ...schema2 };
    delete content1.$schema;
    delete content1.$id;
    delete content1.title;
    delete content2.$schema;
    delete content2.$id;
    delete content2.title;
    
    const merged = mergeItemSchemas([content1, content2], opts);
    
    return {
      $schema: schema1.$schema || schema2.$schema || 'https://json-schema.org/draft/2020-12/schema',
      $id: schema1.$id || schema2.$id || opts.schemaId,
      title: schema1.title || schema2.title || opts.schemaTitle,
      ...merged
    };
  }

  /**
   * Validate a value against a schema (basic validation)
   * @param {*} value - Value to validate
   * @param {Object} schema - JSON Schema
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  function validateBasic(value, schema) {
    const errors = [];
    
    function validate(val, sch, path = '') {
      if (!sch || Object.keys(sch).length === 0) {
        return; // Empty schema accepts anything
      }
      
      const valueType = Core.inferType(val);
      
      // Type check
      if (sch.type) {
        const types = Array.isArray(sch.type) ? sch.type : [sch.type];
        let typeMatch = false;
        
        for (const t of types) {
          if (t === 'integer' && valueType === 'integer') typeMatch = true;
          else if (t === 'number' && (valueType === 'number' || valueType === 'integer')) typeMatch = true;
          else if (t === valueType) typeMatch = true;
        }
        
        if (!typeMatch) {
          errors.push(`${path || 'root'}: Expected type ${sch.type}, got ${valueType}`);
          return;
        }
      }
      
      // Object validation
      if (valueType === 'object' && sch.properties) {
        // Check required properties
        if (sch.required) {
          for (const reqProp of sch.required) {
            if (!(reqProp in val)) {
              errors.push(`${path || 'root'}: Missing required property "${reqProp}"`);
            }
          }
        }
        
        // Validate each property
        for (const key in val) {
          if (sch.properties[key]) {
            validate(val[key], sch.properties[key], path ? `${path}.${key}` : key);
          }
        }
      }
      
      // Array validation
      if (valueType === 'array' && sch.items) {
        for (let i = 0; i < val.length; i++) {
          validate(val[i], sch.items, `${path}[${i}]`);
        }
      }
      
      // Format validation (basic)
      if (valueType === 'string' && sch.format) {
        const detectedFormat = Core.detectFormat(val);
        if (detectedFormat !== sch.format && val.length > 0) {
          // Not a strict error, just a warning
          // errors.push(`${path || 'root'}: Expected format ${sch.format}`);
        }
      }
    }
    
    validate(value, schema);
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get schema statistics
   * @param {Object} schema - JSON Schema
   * @returns {Object} - Statistics
   */
  function getSchemaStats(schema) {
    const stats = {
      totalProperties: 0,
      requiredProperties: 0,
      optionalProperties: 0,
      depth: 0,
      hasArrays: false,
      hasNestedObjects: false,
      formats: []
    };
    
    function analyze(sch, depth = 0) {
      stats.depth = Math.max(stats.depth, depth);
      
      if (sch.format) {
        stats.formats.push(sch.format);
      }
      
      if (sch.type === 'array') {
        stats.hasArrays = true;
        if (sch.items) {
          analyze(sch.items, depth + 1);
        }
      }
      
      if (sch.type === 'object' && sch.properties) {
        const propCount = Object.keys(sch.properties).length;
        stats.totalProperties += propCount;
        
        const requiredSet = new Set(sch.required || []);
        stats.requiredProperties += requiredSet.size;
        stats.optionalProperties += propCount - requiredSet.size;
        
        if (depth > 0) {
          stats.hasNestedObjects = true;
        }
        
        for (const key in sch.properties) {
          analyze(sch.properties[key], depth + 1);
        }
      }
      
      if (sch.anyOf) {
        for (const s of sch.anyOf) {
          analyze(s, depth);
        }
      }
    }
    
    analyze(schema);
    stats.formats = [...new Set(stats.formats)];
    
    return stats;
  }

  // Export to global namespace
  window.SchemaGenerator = {
    inferSchema,
    inferSchemaFromSamples,
    mergeSchemas,
    validateBasic,
    getSchemaStats,
    DEFAULT_OPTIONS
  };

  console.log('SchemaGenerator loaded successfully');
})();
