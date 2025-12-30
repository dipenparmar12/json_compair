/**
 * JSON Toolbox - JSON Fuzzer/Randomizer
 * Generates random valid JSON from schemas or samples.
 * @module json_fuzzer
 * @version 1.0.0
 */
(function () {
  'use strict';

  const Core = window.JSONToolsCore;
  const SchemaGen = window.SchemaGenerator;

  /**
   * Default options for fuzzing
   */
  const DEFAULT_OPTIONS = {
    mode: 'normal', // 'normal', 'edge', 'stress'
    count: 1,
    seed: null, // For reproducible randomness
    stringMinLength: 1,
    stringMaxLength: 50,
    numberMin: 0,
    numberMax: 1000,
    arrayMinItems: 0,
    arrayMaxItems: 10,
    maxDepth: 5
  };

  /**
   * Sample data pools for realistic generation
   */
  const DATA_POOLS = {
    firstNames: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia'],
    lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'],
    domains: ['example.com', 'test.org', 'sample.net', 'demo.io', 'company.com'],
    words: ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor'],
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin'],
    countries: ['USA', 'Canada', 'UK', 'Germany', 'France', 'Japan', 'Australia', 'Brazil', 'India', 'China'],
    colors: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'gray']
  };

  /**
   * Seeded random number generator
   */
  class SeededRandom {
    constructor(seed) {
      this.seed = seed || Date.now();
    }
    
    next() {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return this.seed / 233280;
    }
    
    nextInt(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }
    
    nextFloat(min, max) {
      return this.next() * (max - min) + min;
    }
    
    pick(array) {
      return array[this.nextInt(0, array.length - 1)];
    }
    
    shuffle(array) {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = this.nextInt(0, i);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }
  }

  // Global random instance
  let rng = new SeededRandom();

  /**
   * Generate a random string
   * @param {Object} options - Generation options
   * @param {Object} schema - Schema constraints
   * @returns {string}
   */
  function generateString(options, schema = {}) {
    const minLen = schema.minLength || options.stringMinLength;
    const maxLen = schema.maxLength || options.stringMaxLength;
    const length = rng.nextInt(minLen, maxLen);
    
    // Check for format
    if (schema.format) {
      return generateFormattedString(schema.format, options);
    }
    
    // Check for enum
    if (schema.enum && schema.enum.length > 0) {
      return rng.pick(schema.enum);
    }
    
    // Check for pattern (basic support)
    if (schema.pattern) {
      return generateFromPattern(schema.pattern, length);
    }
    
    // Generate based on mode
    if (options.mode === 'edge') {
      const edgeCases = ['', ' ', '\t', '\n', '\\', '"', "'", '<script>', 'null', 'undefined', '0', '-1', 'true', 'false'];
      return rng.pick(edgeCases);
    }
    
    if (options.mode === 'stress') {
      // Generate very long string
      const stressLen = rng.nextInt(1000, 10000);
      return 'x'.repeat(stressLen);
    }
    
    // Normal mode - generate readable string
    let result = '';
    while (result.length < length) {
      result += rng.pick(DATA_POOLS.words) + ' ';
    }
    return result.trim().substring(0, length);
  }

  /**
   * Generate a string matching a specific format
   * @param {string} format - Format name
   * @param {Object} options - Options
   * @returns {string}
   */
  function generateFormattedString(format, options) {
    switch (format) {
      case 'email':
        return `${rng.pick(DATA_POOLS.firstNames).toLowerCase()}${rng.nextInt(1, 999)}@${rng.pick(DATA_POOLS.domains)}`;
        
      case 'uri':
      case 'url':
        return `https://${rng.pick(DATA_POOLS.domains)}/path/${rng.pick(DATA_POOLS.words)}`;
        
      case 'date-time':
        const dt = new Date(rng.nextInt(2000, 2030), rng.nextInt(0, 11), rng.nextInt(1, 28), 
                          rng.nextInt(0, 23), rng.nextInt(0, 59), rng.nextInt(0, 59));
        return dt.toISOString();
        
      case 'date':
        const d = new Date(rng.nextInt(2000, 2030), rng.nextInt(0, 11), rng.nextInt(1, 28));
        return d.toISOString().split('T')[0];
        
      case 'time':
        return `${String(rng.nextInt(0, 23)).padStart(2, '0')}:${String(rng.nextInt(0, 59)).padStart(2, '0')}:${String(rng.nextInt(0, 59)).padStart(2, '0')}`;
        
      case 'uuid':
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = rng.nextInt(0, 15);
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        
      case 'ipv4':
        return `${rng.nextInt(1, 255)}.${rng.nextInt(0, 255)}.${rng.nextInt(0, 255)}.${rng.nextInt(1, 254)}`;
        
      case 'hostname':
        return `${rng.pick(DATA_POOLS.words)}.${rng.pick(DATA_POOLS.domains)}`;
        
      default:
        return generateString({ ...options, mode: 'normal' }, {});
    }
  }

  /**
   * Generate string from regex pattern (basic support)
   * @param {string} pattern - Regex pattern
   * @param {number} length - Target length
   * @returns {string}
   */
  function generateFromPattern(pattern, length) {
    // Very basic pattern support
    // For complex patterns, fall back to random string
    try {
      const regex = new RegExp(pattern);
      
      // Try a few times to generate matching string
      for (let i = 0; i < 100; i++) {
        const candidate = generateString({ stringMinLength: length, stringMaxLength: length, mode: 'normal' }, {});
        if (regex.test(candidate)) {
          return candidate;
        }
      }
    } catch (e) {
      // Invalid pattern
    }
    
    // Fallback
    return generateString({ stringMinLength: 1, stringMaxLength: length, mode: 'normal' }, {});
  }

  /**
   * Generate a random number
   * @param {Object} options - Generation options
   * @param {Object} schema - Schema constraints
   * @returns {number}
   */
  function generateNumber(options, schema = {}) {
    const min = schema.minimum !== undefined ? schema.minimum : options.numberMin;
    const max = schema.maximum !== undefined ? schema.maximum : options.numberMax;
    
    // Check for enum
    if (schema.enum && schema.enum.length > 0) {
      return rng.pick(schema.enum);
    }
    
    // Edge cases
    if (options.mode === 'edge') {
      const edgeCases = [0, -0, 1, -1, min, max, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 0.1, -0.1, NaN, Infinity, -Infinity];
      const valid = edgeCases.filter(n => isFinite(n) && n >= min && n <= max);
      return valid.length > 0 ? rng.pick(valid) : 0;
    }
    
    if (schema.type === 'integer') {
      return rng.nextInt(Math.ceil(min), Math.floor(max));
    }
    
    // Float with some decimal places
    const value = rng.nextFloat(min, max);
    return Math.round(value * 100) / 100;
  }

  /**
   * Generate a random integer
   * @param {Object} options - Generation options
   * @param {Object} schema - Schema constraints
   * @returns {number}
   */
  function generateInteger(options, schema = {}) {
    return generateNumber(options, { ...schema, type: 'integer' });
  }

  /**
   * Generate a random boolean
   * @param {Object} options - Generation options
   * @returns {boolean}
   */
  function generateBoolean(options) {
    return rng.next() > 0.5;
  }

  /**
   * Generate a random array
   * @param {Object} options - Generation options
   * @param {Object} schema - Schema constraints
   * @param {number} depth - Current depth
   * @returns {Array}
   */
  function generateArray(options, schema = {}, depth = 0) {
    if (depth >= options.maxDepth) {
      return [];
    }
    
    const minItems = schema.minItems !== undefined ? schema.minItems : options.arrayMinItems;
    const maxItems = schema.maxItems !== undefined ? schema.maxItems : options.arrayMaxItems;
    
    // Reduce array size in stress mode to prevent memory issues
    const actualMax = options.mode === 'stress' ? Math.min(maxItems, 100) : maxItems;
    const length = rng.nextInt(minItems, actualMax);
    
    const result = [];
    const itemSchema = schema.items || {};
    
    for (let i = 0; i < length; i++) {
      result.push(generateFromSchema(itemSchema, options, depth + 1));
    }
    
    // Handle uniqueItems
    if (schema.uniqueItems) {
      const unique = [...new Set(result.map(JSON.stringify))].map(JSON.parse);
      return unique;
    }
    
    return result;
  }

  /**
   * Generate a random object
   * @param {Object} options - Generation options
   * @param {Object} schema - Schema constraints
   * @param {number} depth - Current depth
   * @returns {Object}
   */
  function generateObject(options, schema = {}, depth = 0) {
    if (depth >= options.maxDepth) {
      return {};
    }
    
    const result = {};
    const properties = schema.properties || {};
    const required = new Set(schema.required || []);
    
    for (const [key, propSchema] of Object.entries(properties)) {
      // Always include required, randomly include optional
      if (required.has(key) || rng.next() > 0.3) {
        result[key] = generateFromSchema(propSchema, options, depth + 1);
      }
    }
    
    return result;
  }

  /**
   * Generate random data from a JSON Schema
   * @param {Object} schema - JSON Schema
   * @param {Object} [options] - Generation options
   * @param {number} [depth] - Current depth
   * @returns {*}
   */
  function generateFromSchema(schema, options = {}, depth = 0) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    if (!schema || Object.keys(schema).length === 0) {
      // No schema - generate random type
      const types = ['string', 'number', 'boolean'];
      return generateFromSchema({ type: rng.pick(types) }, opts, depth);
    }
    
    // Handle anyOf/oneOf
    if (schema.anyOf) {
      return generateFromSchema(rng.pick(schema.anyOf), opts, depth);
    }
    if (schema.oneOf) {
      return generateFromSchema(rng.pick(schema.oneOf), opts, depth);
    }
    
    // Handle enum at top level
    if (schema.enum && schema.enum.length > 0) {
      return rng.pick(schema.enum);
    }
    
    // Handle const
    if (schema.const !== undefined) {
      return schema.const;
    }
    
    // Handle type
    let type = schema.type;
    if (Array.isArray(type)) {
      type = rng.pick(type);
    }
    
    switch (type) {
      case 'string':
        return generateString(opts, schema);
      case 'integer':
        return generateInteger(opts, schema);
      case 'number':
        return generateNumber(opts, schema);
      case 'boolean':
        return generateBoolean(opts);
      case 'null':
        return null;
      case 'array':
        return generateArray(opts, schema, depth);
      case 'object':
        return generateObject(opts, schema, depth);
      default:
        // Unknown type - generate string
        return generateString(opts, {});
    }
  }

  /**
   * Generate random data from a sample JSON
   * @param {*} sample - Sample JSON
   * @param {Object} [options] - Generation options
   * @returns {*}
   */
  function generateFromSample(sample, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Generate schema from sample
    if (SchemaGen) {
      const schema = SchemaGen.inferSchema(sample, { markRequired: false });
      return generateFromSchema(schema, opts);
    }
    
    // Fallback - simple generation based on sample structure
    return generateLike(sample, opts, 0);
  }

  /**
   * Generate data with same structure as sample
   * @param {*} sample - Sample data
   * @param {Object} options - Options
   * @param {number} depth - Current depth
   * @returns {*}
   */
  function generateLike(sample, options, depth = 0) {
    if (depth >= options.maxDepth) {
      return null;
    }
    
    if (sample === null) return null;
    
    if (Array.isArray(sample)) {
      const length = rng.nextInt(0, Math.max(sample.length, options.arrayMaxItems));
      const result = [];
      for (let i = 0; i < length; i++) {
        const template = sample[i % sample.length];
        result.push(generateLike(template, options, depth + 1));
      }
      return result;
    }
    
    if (typeof sample === 'object') {
      const result = {};
      for (const key in sample) {
        result[key] = generateLike(sample[key], options, depth + 1);
      }
      return result;
    }
    
    if (typeof sample === 'string') {
      const format = Core.detectFormat(sample);
      if (format) {
        return generateFormattedString(format, options);
      }
      return generateString(options, { minLength: 1, maxLength: sample.length * 2 });
    }
    
    if (typeof sample === 'number') {
      if (Number.isInteger(sample)) {
        return rng.nextInt(0, Math.max(sample * 2, 100));
      }
      return rng.nextFloat(0, Math.max(sample * 2, 100));
    }
    
    if (typeof sample === 'boolean') {
      return generateBoolean(options);
    }
    
    return sample;
  }

  /**
   * Generate multiple random samples
   * @param {Object} schemaOrSample - Schema or sample to generate from
   * @param {Object} [options] - Generation options
   * @returns {Array} - Array of generated samples
   */
  function generateMultiple(schemaOrSample, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const count = opts.count || 1;
    
    // Initialize RNG with seed if provided
    if (opts.seed !== null) {
      rng = new SeededRandom(opts.seed);
    } else {
      rng = new SeededRandom();
    }
    
    const results = [];
    
    // Determine if input is schema or sample
    const isSchema = schemaOrSample.$schema || schemaOrSample.type || schemaOrSample.properties;
    
    for (let i = 0; i < count; i++) {
      if (isSchema) {
        results.push(generateFromSchema(schemaOrSample, opts));
      } else {
        results.push(generateFromSample(schemaOrSample, opts));
      }
    }
    
    return results;
  }

  /**
   * Generate edge case data for testing
   * @param {Object} schema - Schema
   * @returns {Array} - Array of edge case samples
   */
  function generateEdgeCases(schema) {
    const cases = [];
    const opts = { mode: 'edge', count: 1 };
    
    // Generate several edge case variations
    for (let i = 0; i < 10; i++) {
      cases.push(generateFromSchema(schema, opts));
    }
    
    // Add specific edge cases
    if (schema.type === 'object') {
      cases.push({}); // Empty object
      if (schema.properties) {
        // Object with only required fields
        const minObj = {};
        for (const key of (schema.required || [])) {
          minObj[key] = generateFromSchema(schema.properties[key], opts);
        }
        cases.push(minObj);
      }
    }
    
    if (schema.type === 'array') {
      cases.push([]); // Empty array
      cases.push([null]); // Array with null
    }
    
    return cases;
  }

  /**
   * Set the random seed for reproducibility
   * @param {number} seed - Seed value
   */
  function setSeed(seed) {
    rng = new SeededRandom(seed);
  }

  // Export to global namespace
  window.JSONFuzzer = {
    generateFromSchema,
    generateFromSample,
    generateMultiple,
    generateEdgeCases,
    generateString,
    generateNumber,
    generateInteger,
    generateBoolean,
    generateArray,
    generateObject,
    generateFormattedString,
    setSeed,
    DATA_POOLS,
    DEFAULT_OPTIONS
  };

  console.log('JSONFuzzer loaded successfully');
})();
